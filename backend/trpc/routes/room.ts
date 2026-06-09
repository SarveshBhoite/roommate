import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../create-context';
import { Room } from '../../models/Room';
import { User } from '../../models/User';

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
  })
});
