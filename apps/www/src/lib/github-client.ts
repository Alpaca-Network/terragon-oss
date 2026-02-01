/**
 * Octokit client factory with rate limit tracking and error conversion.
 */

import { Octokit } from "octokit";
import { updateRateLimitFromHeaders } from "./github-rate-limit";
import { toGitHubError } from "./github-errors";

/**
 * Simple in-memory counter for rate limit tracking failures.
 * This helps monitor if Redis connectivity issues are causing loss of visibility.
 */
let rateLimitTrackingFailureCount = 0;
let lastFailureLogTime = 0;
const FAILURE_LOG_INTERVAL_MS = 60000; // Log at most once per minute

/**
 * Get the current rate limit tracking failure count.
 * Useful for monitoring/health checks.
 */
export function getRateLimitTrackingFailureCount(): number {
  return rateLimitTrackingFailureCount;
}

/**
 * Reset the rate limit tracking failure count.
 * Useful for testing.
 */
export function resetRateLimitTrackingFailureCount(): void {
  rateLimitTrackingFailureCount = 0;
}

/**
 * Options for creating a GitHub client.
 */
export interface GitHubClientOptions {
  /** Authentication token (user OAuth token or app installation token) */
  auth: string;
  /** Unique identifier for rate limit tracking (e.g., "user:{userId}" or "app:{owner}/{repo}") */
  identifier: string;
}

/**
 * Create an Octokit instance with rate limit tracking and error conversion middleware.
 *
 * This factory adds two hooks to the Octokit instance:
 * 1. After hook: Tracks rate limits from response headers
 * 2. Error hook: Converts Octokit errors to typed GitHubError instances
 *
 * @param options - Client configuration options
 * @returns Configured Octokit instance
 *
 * @example
 * // For user operations
 * const octokit = createGitHubClient({
 *   auth: userAccessToken,
 *   identifier: `user:${userId}`,
 * });
 *
 * @example
 * // For app operations
 * const octokit = createGitHubClient({
 *   auth: installationToken,
 *   identifier: `app:${owner}/${repo}`,
 * });
 */
export function createGitHubClient(options: GitHubClientOptions): Octokit {
  const octokit = new Octokit({ auth: options.auth });

  // After hook: track rate limits from response headers
  octokit.hook.after("request", async (response) => {
    try {
      const headers = response.headers as Record<string, string | undefined>;
      await updateRateLimitFromHeaders(options.identifier, headers);
    } catch (error) {
      // Don't fail requests due to rate limit tracking errors
      // Track failures for monitoring purposes
      rateLimitTrackingFailureCount++;

      // Log periodically to avoid log spam during outages
      const now = Date.now();
      if (now - lastFailureLogTime > FAILURE_LOG_INTERVAL_MS) {
        lastFailureLogTime = now;
        console.warn(`[github:client] Rate limit tracking failures detected`, {
          identifier: options.identifier,
          totalFailures: rateLimitTrackingFailureCount,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  // Error hook: convert Octokit errors to typed GitHubError
  octokit.hook.error("request", async (error) => {
    throw toGitHubError(error);
  });

  return octokit;
}
