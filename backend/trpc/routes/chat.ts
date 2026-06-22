import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../create-context';
import { ChatMessage } from '../../models/ChatMessage';
import { User } from '../../models/User';
import { sendPushNotification } from '../../utils/push';

export const chatRouter = createTRPCRouter({
  send: protectedProcedure
    .input(z.object({ message: z.string().min(1, 'Message cannot be empty') }))
    .mutation(async ({ input, ctx }) => {
      const { message } = input;
      const userId = ctx.user.userId;

      const user = await User.findById(userId);
      if (!user || !user.roomId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not in a room' });
      }

      const chatMessage = await ChatMessage.create({
        roomId: user.roomId,
        senderId: user._id,
        senderName: user.name,
        message
      });

      // Notify other roommates in the room
      try {
        const roommates = await User.find({ 
          roomId: user.roomId, 
          _id: { $ne: user._id } 
        });
        
        const tokens = roommates.flatMap(r => r.pushTokens || []);
        if (tokens.length > 0) {
          await sendPushNotification({
            to: tokens,
            title: `New Message from ${user.name} 💬`,
            body: message.length > 50 ? message.substring(0, 50) + '...' : message,
            data: { screen: 'chat' }
          });
        }
      } catch (err) {
        console.error('Failed to send chat push notification:', err);
      }

      return chatMessage;
    }),

  getMessages: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.userId;

    const user = await User.findById(userId);
    if (!user || !user.roomId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not in a room' });
    }

    const messages = await ChatMessage.find({ roomId: user.roomId })
      .sort({ createdAt: -1 })
      .limit(50);

    // Return in chronological order
    return messages.reverse();
  })
});
