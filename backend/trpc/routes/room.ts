import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../create-context';
import { Room } from '../../models/Room';
import { User } from '../../models/User';
import { Chore } from '../../models/Chore';
import { sendPushNotification } from '../../utils/push';

// Helper to generate a unique 6-digit room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const roomRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(3, 'Room name must be at least 3 characters') }))
    .mutation(async ({ input, ctx }) => {
      const { name } = input;
      const adminId = ctx.user.userId;

      // Find if user is already in a room
      const user = await User.findById(adminId);
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      if (user.roomId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are already in a room' });
      }

      // Generate a unique room code
      let code = generateRoomCode();
      let codeExists = await Room.findOne({ code });
      while (codeExists) {
        code = generateRoomCode();
        codeExists = await Room.findOne({ code });
      }

      // Create Room
      const room = await Room.create({
        name,
        code,
        adminId,
        pendingMembers: []
      });

      // Update User to be Admin of this Room
      user.roomId = room._id;
      user.role = 'admin';
      await user.save();

      return {
        room,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          roomId: user.roomId,
          isOptedIn: user.isOptedIn
        }
      };
    }),

  join: protectedProcedure
    .input(z.object({ code: z.string().toUpperCase() }))
    .mutation(async ({ input, ctx }) => {
      const { code } = input;
      const userId = ctx.user.userId;

      const user = await User.findById(userId);
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      if (user.roomId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are already in a room' });
      }

      // Find Room by code
      const room = await Room.findOne({ code });
      if (!room) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Room code not found' });
      }

      // Check if user is already in pending list
      const isAlreadyPending = room.pendingMembers.some(
        (id: any) => id.toString() === userId
      );

      if (isAlreadyPending) {
        return { message: 'Join request is already pending approval' };
      }

      // Add to pending list
      room.pendingMembers.push(userId);
      await room.save();

      return { message: 'Join request sent successfully' };
    }),

  getPendingMembers: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.userId;

    const user = await User.findById(userId);
    if (!user || user.role !== 'admin' || !user.roomId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
    }

    const room = await Room.findById(user.roomId).populate({
      path: 'pendingMembers',
      select: 'name email phone'
    });

    if (!room) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
    }

    return room.pendingMembers;
  }),

  approveMember: protectedProcedure
    .input(z.object({ targetUserId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { targetUserId } = input;
      const adminId = ctx.user.userId;

      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin' || !admin.roomId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }

      const room = await Room.findById(admin.roomId);
      if (!room) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
      }

      // Verify user is in pending
      const pendingIndex = room.pendingMembers.findIndex(
        (id: any) => id.toString() === targetUserId
      );

      if (pendingIndex === -1) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not in pending list' });
      }

      // Remove from pending
      room.pendingMembers.splice(pendingIndex, 1);
      await room.save();

      // Update target user's roomId and role
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      targetUser.roomId = room._id;
      targetUser.role = 'member';
      await targetUser.save();

      return { message: `${targetUser.name} approved successfully` };
    }),

  rejectMember: protectedProcedure
    .input(z.object({ targetUserId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { targetUserId } = input;
      const adminId = ctx.user.userId;

      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin' || !admin.roomId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }

      const room = await Room.findById(admin.roomId);
      if (!room) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
      }

      // Remove from pending
      const pendingIndex = room.pendingMembers.findIndex(
        (id: any) => id.toString() === targetUserId
      );

      if (pendingIndex === -1) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not in pending list' });
      }

      room.pendingMembers.splice(pendingIndex, 1);
      await room.save();

      return { message: 'Join request rejected' };
    }),

  listMembers: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.userId;

    const user = await User.findById(userId);
    if (!user || !user.roomId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not in a room' });
    }

    const members = await User.find({ roomId: user.roomId }).select('name email phone role isOptedIn');
    return members;
  }),

  kickMember: protectedProcedure
    .input(z.object({ targetUserId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { targetUserId } = input;
      const adminId = ctx.user.userId;

      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin' || !admin.roomId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }

      if (targetUserId === adminId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Admin cannot kick themselves. Delete the room instead.' });
      }

      const targetUser = await User.findById(targetUserId);
      if (!targetUser || targetUser.roomId?.toString() !== admin.roomId.toString()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'User is not in your room' });
      }

      // Remove roomId and reset role
      targetUser.roomId = null as any;
      targetUser.role = 'member';
      await targetUser.save();

      // Clean up chores in this room: remove target user from chore rotation loops
      const chores = await Chore.find({ roomId: admin.roomId });
      for (const chore of chores) {
        const targetIdStr = targetUserId.toString();
        
        // Find positions of target user
        const originalIndex = chore.originalRotationOrder.findIndex(
          (id: any) => id.toString() === targetIdStr
        );
        const activeIndex = chore.rotationOrder.findIndex(
          (id: any) => id.toString() === targetIdStr
        );

        if (originalIndex !== -1) {
          chore.originalRotationOrder.splice(originalIndex, 1);
        }

        if (activeIndex !== -1) {
          chore.rotationOrder.splice(activeIndex, 1);
          
          // Adjust currentIndex
          if (chore.rotationOrder.length === 0) {
            chore.currentIndex = 0;
          } else if (chore.currentIndex === activeIndex) {
            // Active turn is the kicked user. Shift turn to next user (or wrap to 0 if they were last)
            if (chore.currentIndex >= chore.rotationOrder.length) {
              chore.currentIndex = 0;
            }
          } else if (chore.currentIndex > activeIndex) {
            // Active turn is after kicked user, so active user index shifted down by 1
            chore.currentIndex -= 1;
          }
        }
        
        await chore.save();
      }

      return { message: `${targetUser.name} kicked from the room` };
    }),

  updateNotice: protectedProcedure
    .input(z.object({ notice: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { notice } = input;
      const adminId = ctx.user.userId;

      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin' || !admin.roomId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }

      const room = await Room.findById(admin.roomId);
      if (!room) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
      }

      room.noticeMarquee = notice;
      await room.save();

      // Send push notification to all roommates (except the admin)
      try {
        const roommates = await User.find({
          roomId: admin.roomId,
          _id: { $ne: adminId }
        });
        
        const tokens = roommates.flatMap(u => u.pushTokens || []);
        if (tokens.length > 0) {
          await sendPushNotification({
            to: tokens,
            title: 'Notice Board Update 📢',
            body: notice ? `New announcement: "${notice}"` : `Notice board was updated.`,
            data: { screen: 'home' }
          });
        }
      } catch (err) {
        console.error('Failed to send notice board update push notification:', err);
      }

      return { noticeMarquee: room.noticeMarquee };
    }),

  getRoomDetails: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.userId;

    const user = await User.findById(userId);
    if (!user || !user.roomId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not in a room' });
    }

    const room = await Room.findById(user.roomId);
    if (!room) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
    }

    return room;
  }),

  transferAdmin: protectedProcedure
    .input(z.object({ targetUserId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { targetUserId } = input;
      const adminId = ctx.user.userId;

      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin' || !admin.roomId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }

      if (targetUserId === adminId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are already the admin' });
      }

      const targetUser = await User.findById(targetUserId);
      if (!targetUser || targetUser.roomId?.toString() !== admin.roomId.toString()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'User is not in your room' });
      }

      const room = await Room.findById(admin.roomId);
      if (!room) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
      }

      // Perform transfer
      room.adminId = targetUserId;
      room.upiId = ""; // Reset UPI ID so the new admin configures their own
      await room.save();

      admin.role = 'member';
      await admin.save();

      targetUser.role = 'admin';
      await targetUser.save();

      return { 
        message: `Admin role transferred to ${targetUser.name}`,
        adminUser: {
          _id: admin._id,
          role: admin.role,
        }
      };
    }),

  updateUpiId: protectedProcedure
    .input(z.object({ upiId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { upiId } = input;
      const adminId = ctx.user.userId;

      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin' || !admin.roomId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }

      const room = await Room.findById(admin.roomId);
      if (!room) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
      }

      room.upiId = upiId.trim();
      await room.save();

      return { upiId: room.upiId };
    })
});
