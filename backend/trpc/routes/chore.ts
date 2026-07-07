import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { v2 as cloudinary } from 'cloudinary';
import { createTRPCRouter, protectedProcedure } from '../create-context';
import { Chore } from '../../models/Chore';
import { ChoreLog } from '../../models/ChoreLog';
import { SwapRequest } from '../../models/SwapRequest';
import { User } from '../../models/User';
import { sendPushNotification } from '../../utils/push';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getAssignedUserForChore(chore: any) {
  const baseUser = chore.rotationOrder[chore.currentIndex];
  if (!baseUser) return null;

  // Find if there is an active debt where toUserId is this baseUser
  // And the ower (fromUserId) is opted-in
  const activeDebt = chore.debts?.find((d: any) => {
    const ower = d.fromUserId;
    const isOwerOptedIn = ower && ower.isOptedIn;
    const isOweeMatch = d.toUserId && d.toUserId._id.toString() === baseUser._id.toString();
    return isOweeMatch && isOwerOptedIn;
  });

  if (activeDebt) {
    return activeDebt.fromUserId; // The ower is assigned
  }
  return baseUser;
}

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
      })
      .populate({
        path: 'debts.fromUserId',
        select: 'name email phone isOptedIn'
      })
      .populate({
        path: 'debts.toUserId',
        select: 'name email phone isOptedIn'
      });

    // Compute active user for each chore taking debt overrides into account
    const results = chores.map(chore => {
      const activeUser = getAssignedUserForChore(chore);
      return {
        ...chore.toObject(),
        activeUser: activeUser ? activeUser.toObject() : null
      };
    });

    return results;
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
    .input(
      z.object({
        choreId: z.string(),
        photoBase64: z.string().optional()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { choreId, photoBase64 } = input;
      const userId = ctx.user.userId;

      const user = await User.findById(userId);
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const chore = await Chore.findById(choreId)
        .populate('rotationOrder')
        .populate('debts.fromUserId')
        .populate('debts.toUserId');
      if (!chore) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chore not found' });
      }

      const assignedUser = getAssignedUserForChore(chore);
      if (!assignedUser || assignedUser._id.toString() !== userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'It is not your turn to complete this chore'
        });
      }

      let imageUrl: string | null = null;
      if (photoBase64) {
        try {
          const uploadRes = await cloudinary.uploader.upload(photoBase64, {
            folder: process.env.CLOUDINARY_FOLDER || 'roommate_chores',
          });
          imageUrl = uploadRes.secure_url;
        } catch (uploadError: any) {
          console.error('Cloudinary upload error:', uploadError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to upload photo proof to Cloudinary'
          });
        }
      }

      // Log completion
      await ChoreLog.create({
        choreId: chore._id,
        userId: user._id,
        userName: user.name,
        choreName: chore.name,
        imageUrl
      });

      // Clear the debt if this chore was completed because of a debt they owed
      const baseUser = chore.rotationOrder[chore.currentIndex];
      if (baseUser && baseUser._id.toString() !== userId) {
        const debtIndex = chore.debts.findIndex((d: any) => 
          d.fromUserId && d.fromUserId._id.toString() === userId && 
          d.toUserId && d.toUserId._id.toString() === baseUser._id.toString()
        );
        if (debtIndex !== -1) {
          chore.debts.splice(debtIndex, 1);
        }
      }

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

      // Rotate to the next index
      if (found) {
        chore.currentIndex = nextIndex;
      }
      
      await chore.save();

      // Notify the next active user
      if (found) {
        try {
          const nextUserObj = order[nextIndex] as any;
          if (nextUserObj && nextUserObj._id) {
            const nextUserId = nextUserObj._id.toString();
            const nextUserDb = await User.findById(nextUserId);
            if (nextUserDb && nextUserDb.pushTokens && nextUserDb.pushTokens.length > 0) {
              await sendPushNotification({
                to: nextUserDb.pushTokens,
                title: 'Your turn for a chore! 🧹',
                body: `It's your turn to complete: "${chore.name}"`,
                data: { screen: 'chores', choreId: chore._id.toString() }
              });
            }
          }
        } catch (err) {
          console.error('Failed to send push notification to next user:', err);
        }
      }

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

      if (fromUserId === toUserId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot swap turns with yourself'
        });
      }

      const chore = await Chore.findById(choreId)
        .populate('rotationOrder')
        .populate('debts.fromUserId')
        .populate('debts.toUserId');
        
      if (!chore) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chore not found' });
      }

      // Check who is currently assigned
      const assignedUser = getAssignedUserForChore(chore);
      if (!assignedUser || assignedUser._id.toString() !== fromUserId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You can only request a swap if it is currently your turn'
        });
      }

      // Verify targeted user is in the rotation order
      const toIndexInLoop = chore.rotationOrder.findIndex(
        (m: any) => m._id.toString() === toUserId
      );

      if (toIndexInLoop === -1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Target user is not in the rotation loop for this chore'
        });
      }

      // Create swap request
      const request = await SwapRequest.create({
        choreId,
        fromUserId,
        toUserId,
        status: 'pending'
      });

      // Notify target user of swap request
      try {
        const fromUser = await User.findById(fromUserId);
        const fromUserName = fromUser ? fromUser.name : 'A roommate';
        const toUser = await User.findById(toUserId);
        if (toUser && toUser.pushTokens && toUser.pushTokens.length > 0) {
          await sendPushNotification({
            to: toUser.pushTokens,
            title: 'Chore Swap Request 🔄',
            body: `${fromUserName} wants to swap their turn for "${chore.name}" with you.`,
            data: { screen: 'chores', requestId: request._id.toString() }
          });
        }
      } catch (err) {
        console.error('Failed to send swap request push notification:', err);
      }

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

      let chore: any = null;
      if (accept) {
        chore = await Chore.findById(request.choreId)
          .populate('rotationOrder')
          .populate('debts.fromUserId')
          .populate('debts.toUserId');
          
        if (!chore) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Chore not found' });
        }

        // Determine who is currently assigned (taking active debts into account)
        const assignedUser = getAssignedUserForChore(chore);
        if (!assignedUser || assignedUser._id.toString() !== request.fromUserId.toString()) {
          request.status = 'declined';
          await request.save();
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Active turn has changed; swap request is no longer valid'
          });
        }

        const accepterId = request.toUserId.toString();

        // Check if there is an active debt where ower is assignedUser and owee is accepterId (Swap Back)
        const activeDebtIndex = chore.debts.findIndex((d: any) => 
          d.fromUserId && d.fromUserId._id.toString() === assignedUser._id.toString() &&
          d.toUserId && d.toUserId._id.toString() === accepterId
        );

        if (activeDebtIndex !== -1) {
          // Rule 2: Swap Back. Do not create a new debt, and keep the existing debt active.
        } else {
          // Rule 1: Normal Swap. Create a new debt: Assigned owes Accepter.
          chore.debts.push({
            fromUserId: assignedUser._id,
            toUserId: request.toUserId
          });
        }

        await chore.save();
        request.status = 'accepted';
      } else {
        request.status = 'declined';
      }

      await request.save();

      // Notify requester of the decision
      try {
        const fromUser = await User.findById(request.fromUserId);
        const toUser = await User.findById(request.toUserId);
        const toUserName = toUser ? toUser.name : 'Your roommate';
        if (fromUser && fromUser.pushTokens && fromUser.pushTokens.length > 0) {
          const choreObj = chore || await Chore.findById(request.choreId);
          const choreName = choreObj ? choreObj.name : 'chore';
          await sendPushNotification({
            to: fromUser.pushTokens,
            title: accept ? 'Swap Request Accepted! ✅' : 'Swap Request Declined ❌',
            body: accept 
              ? `${toUserName} accepted your request to swap "${choreName}"`
              : `${toUserName} declined your request to swap "${choreName}"`,
            data: { screen: 'chores' }
          });
        }
      } catch (err) {
        console.error('Failed to send swap response push notification:', err);
      }

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

      // If user is opting out, auto-rotate any chores where they are currently active
      if (!optIn && user.roomId) {
        const chores = await Chore.find({ roomId: user.roomId }).populate('rotationOrder');
        for (const chore of chores) {
          const baseUser = chore.rotationOrder[chore.currentIndex];
          if (baseUser && baseUser._id.toString() === userId) {
            // Find the next opted-in user in the loop
            const order = chore.rotationOrder;
            const len = order.length;
            let nextIndex = chore.currentIndex;
            let found = false;

            for (let i = 1; i <= len; i++) {
              const checkIdx = (chore.currentIndex + i) % len;
              const checkUser = order[checkIdx] as any;
              // Since the current user just opted out, they are not opted-in anymore
              const isUserOptedIn = checkUser._id.toString() === userId ? false : checkUser.isOptedIn;
              if (checkUser && isUserOptedIn) {
                nextIndex = checkIdx;
                found = true;
                break;
              }
            }

            if (found) {
              chore.currentIndex = nextIndex;
              await chore.save();
            }
          }
        }
      }

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
    }),

  delete: protectedProcedure
    .input(z.object({ choreId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { choreId } = input;
      const adminId = ctx.user.userId;

      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin' || !admin.roomId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }

      const chore = await Chore.findById(choreId);
      if (!chore || chore.roomId.toString() !== admin.roomId.toString()) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chore not found' });
      }

      // Delete the chore
      await Chore.findByIdAndDelete(choreId);

      // Clean up swap requests related to this chore
      await SwapRequest.deleteMany({ choreId });

      // Clean up logs related to this chore
      await ChoreLog.deleteMany({ choreId });

      return { success: true, message: 'Chore deleted successfully' };
    })
});
