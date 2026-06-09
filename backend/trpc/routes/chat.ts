import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../create-context';
import { ChatMessage } from '../../models/ChatMessage';
import { User } from '../../models/User';

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
