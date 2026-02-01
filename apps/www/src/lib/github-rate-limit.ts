/**
 * GitHub API rate limit tracking using Redis.
 * Tracks rate limits from X-RateLimit-* response headers.
 */

import { redis } from "./redis";

const RATE_LIMIT_KEY_PREFIX = "github:ratelimit:";
const RATE_LIMIT_TTL = 3600; // 1 hour

/**
 * Rate limit information from GitHub API response headers.
 */
export interface GitHubRateLimitInfo {
  /** Maximum number of requests allowed per hour */
  limit: number;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Unix timestamp (seconds) when the rate limit resets */
  reset: number;
  /** Number of requests used in the current window */
  used: number;
  /** The rate limit resource (core, search, graphql, etc.) */
  resource: string;
}

/**
 * Update rate limit tracking from GitHub API response headers.
 *
 * @param identifier - Unique identifier for the rate limit bucket
 *                     (e.g., "user:{userId}" or "app:{owner}/{repo}")
 * @param headers - Response headers from GitHub API
 */
export async function updateRateLimitFromHeaders(
  identifier: string,
  headers: Record<string, string | undefined>,
): Promise<void> {
  const limit = headers["x-ratelimit-limit"];
  const remaining = headers["x-ratelimit-remaining"];
  const reset = headers["x-ratelimit-reset"];
  const used = headers["x-ratelimit-used"];
  const resource = headers["x-ratelimit-resource"] || "core";

  // Skip if essential headers are missing
  if (!limit || !remaining || !reset) {
    return;
  }

  const info: GitHubRateLimitInfo = {
    limit: parseInt(limit, 10),
    remaining: parseInt(remaining, 10),
    reset: parseInt(reset, 10),
    used: parseInt(used || "0", 10),
    resource,
  };

  const key = `${RATE_LIMIT_KEY_PREFIX}${identifier}:${resource}`;

  await redis.set(key, JSON.stringify(info), { ex: RATE_LIMIT_TTL });

  // Log warning if approaching limit (< 10% remaining)
  if (info.remaining < info.limit * 0.1) {
    const resetDate = new Date(info.reset * 1000);
    const percentRemaining = ((info.remaining / info.limit) * 100).toFixed(1);
    console.warn(`[github:rate-limit] Low rate limit for ${identifier}`, {
      resource,
      remaining: info.remaining,
      limit: info.limit,
      percentRemaining: `${percentRemaining}%`,
      resetAt: resetDate.toISOString(),
    });
  }
}

/**
 * Get the current rate limit info for an identifier.
 *
 * @param identifier - Unique identifier for the rate limit bucket
 * @param resource - Rate limit resource type (default: "core")
 * @returns Rate limit info or null if not tracked
 */
export async function getRateLimitInfo(
  identifier: string,
  resource: string = "core",
): Promise<GitHubRateLimitInfo | null> {
  const key = `${RATE_LIMIT_KEY_PREFIX}${identifier}:${resource}`;
  const data = await redis.get(key);

  if (!data) {
    return null;
  }

  return JSON.parse(data as string) as GitHubRateLimitInfo;
}

/**
 * Check if requests should be throttled based on rate limit status.
 *
 * @param identifier - Unique identifier for the rate limit bucket
 * @param resource - Rate limit resource type (default: "core")
 * @returns Object with throttle flag and optional wait time in milliseconds
 */
export async function shouldThrottle(
  identifier: string,
  resource: string = "core",
): Promise<{ throttle: boolean; waitMs?: number }> {
  const info = await getRateLimitInfo(identifier, resource);

  if (!info) {
    return { throttle: false };
  }

  // Throttle if less than 5% remaining
  if (info.remaining < info.limit * 0.05) {
    const waitMs = Math.max(0, info.reset * 1000 - Date.now());
    return { throttle: true, waitMs };
  }

  return { throttle: false };
}

/**
 * Get the time until rate limit resets.
 *
 * @param identifier - Unique identifier for the rate limit bucket
 * @param resource - Rate limit resource type (default: "core")
 * @returns Milliseconds until reset, or null if not tracked
 */
export async function getTimeUntilReset(
  identifier: string,
  resource: string = "core",
): Promise<number | null> {
  const info = await getRateLimitInfo(identifier, resource);

  if (!info) {
    return null;
  }

  return Math.max(0, info.reset * 1000 - Date.now());
}

/**
 * Known GitHub rate limit resources.
 * These are the main resource types tracked by the GitHub API.
 */
const KNOWN_RESOURCES = [
  "core",
  "search",
  "graphql",
  "integration_manifest",
  "code_scanning_upload",
  "actions_runner_registration",
  "scim",
  "dependency_snapshots",
  "audit_log",
  "code_search",
] as const;

/**
 * Clear rate limit tracking for an identifier.
 * Useful for testing or when tokens are refreshed.
 *
 * @param identifier - Unique identifier for the rate limit bucket
 * @param resource - Rate limit resource type (optional, clears all known resources if not specified)
 */
export async function clearRateLimitInfo(
  identifier: string,
  resource?: string,
): Promise<void> {
  if (resource) {
    const key = `${RATE_LIMIT_KEY_PREFIX}${identifier}:${resource}`;
    await redis.del(key);
  } else {
    // Clear all known resources for this identifier
    // Using explicit key deletion instead of KEYS/SCAN for better performance
    const keys = KNOWN_RESOURCES.map(
      (res) => `${RATE_LIMIT_KEY_PREFIX}${identifier}:${res}`,
    );
    await Promise.all(keys.map((key) => redis.del(key)));
  }
}
