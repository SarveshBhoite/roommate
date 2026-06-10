import { httpLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import superjson from 'superjson';

import type { AppRouter as OriginalAppRouter } from '../backend/trpc/app-router';

export type AppRouter = OriginalAppRouter;
export const trpc = createTRPCReact<AppRouter>() as any;

export const getBaseUrl = () => {
  // Try to read environment variable
  const url = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  if (url) {
    return url;
  }

  // Fallback default for local development. Wi-Fi IP used for Expo Go physical device testing.
  return 'http://10.66.207.162:3000';
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

export const formatError = (error: any): string => {
  if (!error) return 'Something went wrong';

  // If there's a JSON array string representing validation issues (e.g. Zod)
  if (error.message && (error.message.startsWith('[') || error.message.startsWith('{'))) {
    try {
      const parsed = JSON.parse(error.message);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => item.message).join('\n');
      } else if (parsed.message) {
        return parsed.message;
      }
    } catch (e) {
      // Fallback if JSON parsing fails
    }
  }

  return error.message || 'Something went wrong';
};

declare global {
  var authToken: string | undefined;
}
