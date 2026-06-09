import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../create-context';
import { Chore } from '../../models/Chore';
import { ChoreLog } from '../../models/ChoreLog';
import { SwapRequest } from '../../models/SwapRequest';
import { User } from '../../models/User';

export const choreRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.roomId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not in a room' });
    }

    // List all chores in the room
    const chores = await Chore.find({ roomId: user.roomId })
      .populate({
        path: 'rotationOrder',
        select: 'name email phone isOptedIn'
      })
      .populate({
        path: 'originalRotationOrder',
        select: 'name email phone isOptedIn'
      });

    return chores;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(3, 'Chore name must be at least 3 characters'),
        rotationOrder: z.array(z.string()).min(1, 'Must have at least 1 person in the loop')
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { name, rotationOrder } = input;
      const adminId = ctx.user.userId;

      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin' || !admin.roomId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }

      // Create Chore
      const chore = await Chore.create({
        name,
        roomId: admin.roomId,
        originalRotationOrder: rotationOrder,
        rotationOrder,
        currentIndex: 0
      });

      return chore;
    }),

  markDone: protectedProcedure
    .input(z.object({ choreId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { choreId } = input;
      const userId = ctx.user.userId;

      const user = await User.findById(userId);
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const chore = await Chore.findById(choreId).populate('rotationOrder');
      if (!chore) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chore not found' });
      }

      const activeUserId = chore.rotationOrder[chore.currentIndex]?._id.toString();
      if (activeUserId !== userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'It is not your turn to complete this chore'
        });
      }

      // Log completion
      await ChoreLog.create({
        choreId: chore._id,
        userId: user._id,
        userName: user.name,
        choreName: chore.name
      });

      // Find next user in loop who is opted-in
      const order = chore.rotationOrder;
      const len = order.length;
      let nextIndex = chore.currentIndex;
      let found = false;

      // Loop up to 1 full rotation to find an opted-in user
      for (let i = 1; i <= len; i++) {
        const checkIdx = (chore.currentIndex + i) % len;
        const checkUser = order[checkIdx] as any;
        if (checkUser && checkUser.isOptedIn) {
          nextIndex = checkIdx;
          found = true;
          break;
        }
      }

      // If we found an opted-in user, rotate to them. Else, it stays at the current user.
      if (found) {
        // Reset check: if nextIndex <= current, we are wrapping back to start.
        if (nextIndex <= chore.currentIndex) {
          // Restore the original rotation order (deleting active swapped states)
          chore.rotationOrder = chore.originalRotationOrder;
        }
        chore.currentIndex = nextIndex;
      }
      
      await chore.save();

      return {
        message: 'Chore completed and turn rotated',
        chore
      };
    }),

  createSwapRequest: protectedProcedure
    .input(z.object({ choreId: z.string(), toUserId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { choreId, toUserId } = input;
      const fromUserId = ctx.user.userId;

      const chore = await Chore.findById(choreId);
      if (!chore) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chore not found' });
      }

      const activeUserId = chore.rotationOrder[chore.currentIndex]?.toString();
      if (activeUserId !== fromUserId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You can only request a swap if it is currently your turn'
        });
      }

      // Verify targeted user is in the rotation order
      const fromIndexInLoop = chore.currentIndex;
      const toIndexInLoop = chore.rotationOrder.findIndex(
        (id: any) => id.toString() === toUserId
      );

      if (toIndexInLoop === -1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Target user is not in the rotation loop for this chore'
        });
      }

      // Swap constraints: Can only swap with roommates who appear LATER in the current cycle
      if (toIndexInLoop <= fromIndexInLoop) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You can only swap turns with roommates whose turns are scheduled after yours in this cycle'
        });
      }

      // Create swap request
      const request = await SwapRequest.create({
        choreId,
        fromUserId,
        toUserId,
        status: 'pending'
      });

      return request;
    }),

  listSwapRequests: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.userId;

    // Get all pending swap requests sent to the current user
    const requests = await SwapRequest.find({
      toUserId: userId,
      status: 'pending'
    })
      .populate({ path: 'choreId', select: 'name' })
      .populate({ path: 'fromUserId', select: 'name email' });

    return requests;
  }),

  respondToSwap: protectedProcedure
    .input(z.object({ requestId: z.string(), accept: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { requestId, accept } = input;
      const userId = ctx.user.userId;

      const request = await SwapRequest.findById(requestId);
      if (!request || request.status !== 'pending') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pending swap request not found' });
      }

      if (request.toUserId.toString() !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not authorized to respond to this request' });
      }

      if (accept) {
        const chore = await Chore.findById(request.choreId);
        if (!chore) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Chore not found' });
        }

        // Verify that the turn is still on the requesting user
        const activeUserId = chore.rotationOrder[chore.currentIndex]?.toString();
        if (activeUserId !== request.fromUserId.toString()) {
          request.status = 'declined';
          await request.save();
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Active turn has changed; swap request is no longer valid'
          });
        }

        // Swap their positions in the rotationOrder array
        const fromIdx = chore.rotationOrder.findIndex(
          (id: any) => id.toString() === request.fromUserId.toString()
        );
        const toIdx = chore.rotationOrder.findIndex(
          (id: any) => id.toString() === request.toUserId.toString()
        );

        if (fromIdx !== -1 && toIdx !== -1) {
          const temp = chore.rotationOrder[fromIdx];
          chore.rotationOrder[fromIdx] = chore.rotationOrder[toIdx];
          chore.rotationOrder[toIdx] = temp;
          await chore.save();
        }

        request.status = 'accepted';
      } else {
        request.status = 'declined';
      }

      await request.save();
      return { status: request.status };
    }),

  toggleOptOut: protectedProcedure
    .input(z.object({ optIn: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { optIn } = input;
      const userId = ctx.user.userId;

      const user = await User.findById(userId);
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      user.isOptedIn = optIn;
      await user.save();

      return { isOptedIn: user.isOptedIn };
    }),

  getLogs: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.roomId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not in a room' });
    }

    // Get all chore activity logs for chores inside this room
    const chores = await Chore.find({ roomId: user.roomId });
    const choreIds = chores.map(c => c._id);

    const logs = await ChoreLog.find({ choreId: { $in: choreIds } })
      .sort({ completedAt: -1 })
      .limit(50);

    return logs;
  }),

  updateRotation: protectedProcedure
    .input(
      z.object({
        choreId: z.string(),
        rotationOrder: z.array(z.string()).min(1, 'Loop must have at least 1 person')
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { choreId, rotationOrder } = input;
      const adminId = ctx.user.userId;

      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin' || !admin.roomId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }

      const chore = await Chore.findById(choreId);
      if (!chore || chore.roomId.toString() !== admin.roomId.toString()) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chore not found' });
      }

      // Update original and active orders
      chore.originalRotationOrder = rotationOrder;
      chore.rotationOrder = rotationOrder;
      chore.currentIndex = 0; // Reset active turn to first index

      await chore.save();
      return chore;
    })
});
