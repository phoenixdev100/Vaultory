import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';

/**
 * Query cache holds *decrypted* vault data while the vault is unlocked, so it
 * is never persisted to disk and is cleared whenever the vault locks.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry auth/validation failures - only transient ones.
        if (error instanceof ApiError && error.status > 0 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});
