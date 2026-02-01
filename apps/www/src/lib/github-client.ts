/**
 * Octokit client factory with rate limit tracking and error conversion.
 */

import { Octokit } from "octokit";
import { updateRateLimitFromHeaders } from "./github-rate-limit";
import { toGitHubError } from "./github-errors";

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
      console.warn(
        `[github:client] Failed to update rate limit tracking for ${options.identifier}:`,
        error,
      );
    }
  });

  // Error hook: convert Octokit errors to typed GitHubError
  octokit.hook.error("request", async (error) => {
    throw toGitHubError(error);
  });

  return octokit;
}
