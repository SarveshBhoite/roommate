import { createTRPCRouter, publicProcedure } from '../create-context';

export const healthRouter = createTRPCRouter({
  check: publicProcedure.query(() => {
    return {
      status: 'ok',
      message: 'Hubmate tRPC API is operational',
      timestamp: new Date().toISOString()
    };
  }),
});
