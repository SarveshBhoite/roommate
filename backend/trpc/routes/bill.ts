import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createTRPCRouter, protectedProcedure } from '../create-context';
import { Contribution } from '../../models/Contribution';
import { User } from '../../models/User';

// Initialize Razorpay conditionally
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

let razorpay: Razorpay | null = null;
if (razorpayKeyId && razorpayKeySecret) {
  try {
    razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });
  } catch (error) {
    console.error('Error initializing Razorpay:', error);
  }
}

export const billRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3, 'Title must be at least 3 characters'),
        totalAmount: z.number().positive('Amount must be positive'),
        userIds: z.array(z.string()).min(1, 'Select at least one roommate')
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { title, totalAmount, userIds } = input;
      const adminId = ctx.user.userId;

      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin' || !admin.roomId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }

      // Divide amount equally
      const shareAmount = Math.round((totalAmount / userIds.length) * 100) / 100;

      const splits = userIds.map(userId => ({
        userId,
        shareAmount,
        status: 'unpaid' as const,
        razorpayOrderId: null,
        razorpayPaymentId: null
      }));

      // Create contribution
      const contribution = await Contribution.create({
        title,
        totalAmount,
        roomId: admin.roomId,
        splits
      });

      return contribution;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.roomId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not in a room' });
    }

    const contributions = await Contribution.find({ roomId: user.roomId })
      .populate({ path: 'splits.userId', select: 'name email phone' })
      .sort({ createdAt: -1 });

    return contributions;
  }),

  createRazorpayOrder: protectedProcedure
    .input(z.object({ contributionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { contributionId } = input;
      const userId = ctx.user.userId;

      const contribution = await Contribution.findById(contributionId);
      if (!contribution) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Contribution not found' });
      }

      const userSplit = contribution.splits.find(
        (split: any) => split.userId.toString() === userId
      );

      if (!userSplit) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not included in this split' });
      }

      if (userSplit.status === 'paid') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You have already paid this contribution' });
      }

      const amountInPaise = Math.round(userSplit.shareAmount * 100);

      // Check if real Razorpay is set up
      if (razorpay) {
        try {
          const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `receipt_${contributionId.substring(0, 10)}_${userId.substring(0, 10)}`,
          });

          // Save Razorpay order ID to user split
          userSplit.razorpayOrderId = order.id;
          await contribution.save();

          return {
            isMock: false,
            keyId: razorpayKeyId,
            orderId: order.id,
            amount: amountInPaise,
            currency: 'INR',
            title: contribution.title
          };
        } catch (error: any) {
          console.error('Razorpay Order creation error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Failed to create payment order with Razorpay'
          });
        }
      } else {
        // Mock payment order for sandbox testing
        const mockOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
        userSplit.razorpayOrderId = mockOrderId;
        await contribution.save();

        return {
          isMock: true,
          keyId: 'rzp_test_mockKeyId12345',
          orderId: mockOrderId,
          amount: amountInPaise,
          currency: 'INR',
          title: contribution.title
        };
      }
    }),

  verifyPayment: protectedProcedure
    .input(
      z.object({
        contributionId: z.string(),
        razorpayPaymentId: z.string(),
        razorpayOrderId: z.string(),
        razorpaySignature: z.string().optional() // Optional for mock validation
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { contributionId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = input;
      const userId = ctx.user.userId;

      const contribution = await Contribution.findById(contributionId);
      if (!contribution) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Contribution not found' });
      }

      const userSplit = contribution.splits.find(
        (split: any) => split.userId.toString() === userId
      );

      if (!userSplit) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not included in this split' });
      }

      // Verification Logic
      let isVerified = false;

      if (
        razorpayOrderId.startsWith('order_mock_') ||
        (razorpayPaymentId.startsWith('pay_mock_') && (!razorpayKeyId || razorpayKeyId.startsWith('rzp_test_')))
      ) {
        // Sandbox verification (always true for mock/simulated payments in test/development mode)
        isVerified = true;
      } else if (razorpayKeySecret && razorpaySignature) {
        // Real Razorpay Signature verification
        const text = razorpayOrderId + '|' + razorpayPaymentId;
        const generatedSignature = crypto
          .createHmac('sha256', razorpayKeySecret)
          .update(text)
          .digest('hex');

        isVerified = generatedSignature === razorpaySignature;
      }

      if (!isVerified) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Payment verification failed. Invalid signature.'
        });
      }

      // Update split status to Paid
      userSplit.status = 'paid';
      userSplit.razorpayPaymentId = razorpayPaymentId;
      await contribution.save();

      return { success: true, status: 'paid' };
    }),

  markAsPaid: protectedProcedure
    .input(z.object({ contributionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { contributionId } = input;
      const userId = ctx.user.userId;

      const contribution = await Contribution.findById(contributionId);
      if (!contribution) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Contribution not found' });
      }

      const userSplit = contribution.splits.find(
        (split: any) => split.userId.toString() === userId
      );

      if (!userSplit) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You are not included in this split' });
      }

      userSplit.status = 'paid';
      userSplit.razorpayPaymentId = `upi_${crypto.randomBytes(8).toString('hex')}`;
      await contribution.save();

      return { success: true, status: 'paid' };
    })
});
