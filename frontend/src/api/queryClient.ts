import { QueryClient } from '@tanstack/react-query';

// Single shared client, in its own module so the auth store can clear it on an
// identity change without importing from main.tsx.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 120000, // Refetch every 2 minutes (120,000ms)
      refetchOnWindowFocus: false,
    },
  },
});
