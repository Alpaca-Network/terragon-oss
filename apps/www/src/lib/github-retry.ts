/**
 * Retry utility for GitHub API operations with exponential backoff.
 */

import {
  GitHubError,
  GitHubRateLimitError,
  GitHubSecondaryRateLimitError,
} from "./github-errors";

/**
 * Options for retrying GitHub requests.
 */
export interface GitHubRetryOptions {
  /** Label for logging (e.g., "update-pr:owner/repo#123") */
  label: string;
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
}

const DEFAULT_OPTIONS = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
} as const;

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate the retry delay based on the error type and attempt number.
 */
function getRetryDelay(
  error: GitHubError,
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  // For rate limit errors, wait until reset time
  if (error instanceof GitHubRateLimitError) {
    return Math.min(error.getWaitMs(), maxDelayMs);
  }

  // For secondary rate limit, use retry-after value
  if (error instanceof GitHubSecondaryRateLimitError) {
    return Math.min(error.getWaitMs(), maxDelayMs);
  }

  // Exponential backoff with jitter for other retryable errors
  const exponentialDelay = Math.min(
    baseDelayMs * Math.pow(2, attempt - 1),
    maxDelayMs,
  );
  const jitter = exponentialDelay * 0.3 * Math.random();
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Retry a GitHub API request with exponential backoff.
 *
 * This utility will retry requests that fail with retryable errors:
 * - GitHubRateLimitError: Waits until the rate limit resets
 * - GitHubSecondaryRateLimitError: Waits for the retry-after period
 * - GitHubServerError (5xx): Uses exponential backoff with jitter
 *
 * Non-retryable errors (4xx except rate limits) are thrown immediately.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all attempts fail
 *
 * @example
 * const pr = await retryGitHubRequest(
 *   () => octokit.rest.pulls.get({ owner, repo, pull_number }),
 *   { label: `get-pr:${owner}/${repo}#${pull_number}` }
 * );
 */
export async function retryGitHubRequest<T>(
  fn: () => Promise<T>,
  options: GitHubRetryOptions,
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_OPTIONS.maxAttempts;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_OPTIONS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_OPTIONS.maxDelayMs;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.log(
          `[github:retry] Attempting ${options.label} (attempt ${attempt}/${maxAttempts})`,
        );
      }
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = error instanceof GitHubError && error.isRetryable();

      console.warn(
        `[github:retry] ${options.label} failed (attempt ${attempt}/${maxAttempts}):`,
        {
          error: lastError.message,
          isRetryable,
          errorType: error instanceof GitHubError ? error.name : "Error",
        },
      );

      // If not retryable or last attempt, throw immediately
      if (!isRetryable || attempt >= maxAttempts) {
        break;
      }

      // Calculate delay and wait
      const delay = getRetryDelay(
        error as GitHubError,
        attempt,
        baseDelayMs,
        maxDelayMs,
      );
      console.log(`[github:retry] Retrying ${options.label} in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Wrap an async function with retry logic.
 *
 * @param fn - The async function to wrap
 * @param options - Retry configuration options
 * @returns A new function that retries on failure
 *
 * @example
 * const getPRWithRetry = withGitHubRetry(
 *   (owner: string, repo: string, prNumber: number) =>
 *     octokit.rest.pulls.get({ owner, repo, pull_number: prNumber }),
 *   { label: "get-pr" }
 * );
 */
export function withGitHubRetry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: GitHubRetryOptions,
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => retryGitHubRequest(() => fn(...args), options);
}
