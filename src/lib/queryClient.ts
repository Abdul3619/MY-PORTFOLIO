import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes stale time
        gcTime: 1000 * 60 * 30, // 30 minutes cache time
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
