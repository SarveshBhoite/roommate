import { httpLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import superjson from 'superjson';

import type { AppRouter as OriginalAppRouter } from '../backend/trpc/app-router';

export type AppRouter = OriginalAppRouter;
export const trpc = createTRPCReact<AppRouter>() as any;

const getBaseUrl = () => {
  // Try to read environment variable
  const url = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  if (url) {
    return url;
  }

  // Fallback default for local development.
  // Note: For physical device testing, you should replace this with your machine's local IP address (e.g., http://192.168.x.x:3000)
  return 'http://localhost:3000';
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/trpc`,
      transformer: superjson,
      headers() {
        const token = global.authToken;
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

declare global {
  var authToken: string | undefined;
}
