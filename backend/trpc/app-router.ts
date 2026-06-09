import { createTRPCRouter } from './create-context';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { roomRouter } from './routes/room';
import { choreRouter } from './routes/chore';
import { billRouter } from './routes/bill';
import { chatRouter } from './routes/chat';

export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  room: roomRouter,
  chore: choreRouter,
  bill: billRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
