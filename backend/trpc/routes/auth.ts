import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../create-context';
import { User } from '../../models/User';
import { signToken } from '../../utils/jwt';

export const authRouter = createTRPCRouter({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email('Invalid email address'),
        phone: z.string().regex(/^[0-9]{10}$/, 'Phone number must be exactly 10 digits'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
      })
    )
    .mutation(async ({ input }) => {
      const { name, email, phone, password } = input;

      // Check for existing email or phone
      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { phone }],
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User with this email or phone number already exists',
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        phone,
        password: hashedPassword,
      });

      // Sign JWT token
      const token = signToken({
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        roomId: user.roomId?.toString(),
      });

      return {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          roomId: user.roomId,
          isOptedIn: user.isOptedIn,
        },
      };
    }),

  login: publicProcedure
    .input(
      z.object({
        identifier: z.string(), // can be email or phone
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { identifier, password } = input;

      // Find user by email or phone
      const user = await User.findOne({
        $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
      });

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      // Sign token
      const token = signToken({
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        roomId: user.roomId?.toString(),
      });

      return {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          roomId: user.roomId,
          isOptedIn: user.isOptedIn,
        },
      };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await User.findById(ctx.user.userId).select('-password');
    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }
    return user;
  }),
});
