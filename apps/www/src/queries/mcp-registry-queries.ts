import { useQuery } from "@tanstack/react-query";
import { searchRegistriesCombined } from "@/lib/mcp-registry";

export const mcpRegistryQueryKeys = {
  search: (query: string) => ["mcp-registry", "search", query] as const,
};

/**
 * Hook to search MCP registries (Official + Smithery combined)
 * Only executes when query has 2+ characters and is enabled
 */
export function useMcpRegistrySearch(query: string, enabled = true) {
  return useQuery({
    queryKey: mcpRegistryQueryKeys.search(query),
    queryFn: () => searchRegistriesCombined(query),
    enabled: enabled && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
