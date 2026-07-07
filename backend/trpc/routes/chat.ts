import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { v2 as cloudinary } from 'cloudinary';
import { createTRPCRouter, protectedProcedure } from '../create-context';
import { ChatMessage } from '../../models/ChatMessage';
import { User } from '../../models/User';
import { sendPushNotification } from '../../utils/push';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const chatRouter = createTRPCRouter({
  send: protectedProcedure
    .input(
      z.object({
        message: z.string().optional(),
        photoBase64: z.string().optional()
      }).refine(data => data.message || data.photoBase64, {
        message: 'Cannot send an empty message'
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { message, photoBase64 } = input;
      const userId = ctx.user.userId;

      const user = await User.findById(userId);
      if (!user || !user.roomId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not in a room' });
      }

      let imageUrl: string | null = null;
      if (photoBase64) {
        try {
          const uploadRes = await cloudinary.uploader.upload(photoBase64, {
            folder: process.env.CLOUDINARY_FOLDER || 'roommate_chat',
          });
          imageUrl = uploadRes.secure_url;
        } catch (uploadError: any) {
          console.error('Cloudinary upload error in chat:', uploadError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to upload photo to Cloudinary'
          });
        }
      }

      const chatMessage = await ChatMessage.create({
        roomId: user.roomId,
        senderId: user._id,
        senderName: user.name,
        message: message || '',
        imageUrl
      });

      // Notify other roommates in the room
      try {
        const roommates = await User.find({ 
          roomId: user.roomId, 
          _id: { $ne: user._id } 
        });
        
        const tokens = roommates.flatMap(r => r.pushTokens || []);
        if (tokens.length > 0) {
          const notifBody = message ? message : '📷 Sent a photo';
          await sendPushNotification({
            to: tokens,
            title: `New Message from ${user.name} 💬`,
            body: notifBody.length > 50 ? notifBody.substring(0, 50) + '...' : notifBody,
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
