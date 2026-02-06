import { QueryClient } from "@tanstack/react-query";

let browserQueryClient: QueryClient | undefined = undefined;
const isServer = typeof window === "undefined";

export function getOrCreateQueryClient(): QueryClient {
  let queryClient: QueryClient | undefined = undefined;
  if (isServer || !browserQueryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          gcTime: 5 * 60 * 1000, // 5 min garbage collection
          refetchOnWindowFocus: false, // Prevent refetch spam on tab switch
          retry: 1, // Reduce retries (default is 3)
        },
      },
    });
  }
  if (!isServer && !browserQueryClient) {
    browserQueryClient = queryClient;
  }
  if (isServer) {
    return queryClient!;
  }
  return browserQueryClient!;
}
