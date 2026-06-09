import { createTRPCRouter } from './create-context';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';

export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
