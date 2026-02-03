import type { RegistrySearchResult, RegistrySearchResults } from "./types";
import {
  transformOfficialRegistryResponse,
  transformSmitheryRegistryResponse,
} from "./transform";

// In-memory cache with TTL
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });

  // Probabilistic cache cleanup (10% chance on each set)
  if (Math.random() < 0.1) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        cache.delete(k);
      }
    }
  }
}

/**
 * Search the Official MCP Registry
 * API docs: https://registry.modelcontextprotocol.io/
 */
export async function searchOfficialRegistry(
  query: string,
  limit = 20,
): Promise<RegistrySearchResult[]> {
  const cacheKey = `official:${query}:${limit}`;
  const cached = getCached<RegistrySearchResult[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    q: query,
    count: String(limit),
  });

  const response = await fetch(
    `https://registry.modelcontextprotocol.io/servers?${params}`,
    {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    },
  );

  if (!response.ok) {
    throw new Error(
      `Official MCP Registry returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();
  const results = transformOfficialRegistryResponse(data);
  setCache(cacheKey, results);
  return results;
}

/**
 * Search the Smithery Registry
 * API docs: https://smithery.ai/docs/use/registry
 */
export async function searchSmitheryRegistry(
  query: string,
  page = 1,
  pageSize = 20,
): Promise<RegistrySearchResult[]> {
  const cacheKey = `smithery:${query}:${page}:${pageSize}`;
  const cached = getCached<RegistrySearchResult[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    q: query,
    page: String(page),
    pageSize: String(pageSize),
  });

  const response = await fetch(
    `https://registry.smithery.ai/servers?${params}`,
    {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    },
  );

  if (!response.ok) {
    throw new Error(
      `Smithery Registry returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();
  const results = transformSmitheryRegistryResponse(data);
  setCache(cacheKey, results);
  return results;
}

/**
 * Search both registries concurrently and combine results
 * Returns results from both registries even if one fails
 */
export async function searchAllRegistries(
  query: string,
): Promise<RegistrySearchResults> {
  const errors: string[] = [];

  const [officialResult, smitheryResult] = await Promise.allSettled([
    searchOfficialRegistry(query),
    searchSmitheryRegistry(query),
  ]);

  const official =
    officialResult.status === "fulfilled" ? officialResult.value : [];
  const smithery =
    smitheryResult.status === "fulfilled" ? smitheryResult.value : [];

  if (officialResult.status === "rejected") {
    console.error("Official registry search failed:", officialResult.reason);
    errors.push("Official MCP Registry unavailable");
  }

  if (smitheryResult.status === "rejected") {
    console.error("Smithery registry search failed:", smitheryResult.reason);
    errors.push("Smithery Registry unavailable");
  }

  return {
    official,
    smithery,
    errors,
  };
}

/**
 * Get combined and deduplicated results from both registries
 */
export async function searchRegistriesCombined(
  query: string,
): Promise<{ results: RegistrySearchResult[]; errors: string[] }> {
  const { official, smithery, errors } = await searchAllRegistries(query);

  // Combine results, preferring official registry for duplicates
  const seenNames = new Set<string>();
  const combined: RegistrySearchResult[] = [];

  // Add official results first (higher priority)
  for (const result of official) {
    const normalizedName = result.name.toLowerCase();
    if (!seenNames.has(normalizedName)) {
      seenNames.add(normalizedName);
      combined.push(result);
    }
  }

  // Add smithery results that aren't duplicates
  for (const result of smithery) {
    const normalizedName = result.name.toLowerCase();
    if (!seenNames.has(normalizedName)) {
      seenNames.add(normalizedName);
      combined.push(result);
    }
  }

  return { results: combined, errors };
}

/**
 * Clear the registry cache (useful for testing or manual refresh)
 */
export function clearRegistryCache(): void {
  cache.clear();
}
