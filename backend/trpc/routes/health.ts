import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export const healthRouter = createTRPCRouter({
  check: publicProcedure.query(() => {
    return {
      status: 'ok',
      message: 'Hubmate tRPC API is operational',
      timestamp: new Date().toISOString()
    };
  }),

  checkUpdate: publicProcedure
    .input(z.object({ currentVersion: z.string() }))
    .query(async ({ input }) => {
      const latestVersion = process.env.LATEST_APP_VERSION || '1.0.4';
      const updateUrl = process.env.APP_UPDATE_URL || 'https://play.google.com/store/apps/details?id=com.hubmate.app';

      const needsUpdate = compareVersions(input.currentVersion, latestVersion) < 0;

      return {
        needsUpdate,
        latestVersion,
        updateUrl
      };
    })
});
