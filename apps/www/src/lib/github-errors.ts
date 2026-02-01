/**
 * Custom error hierarchy for GitHub API operations.
 * Provides typed errors with retry semantics.
 */

/**
 * Base class for all GitHub-related errors.
 */
export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "GitHubError";
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }

  /**
   * Whether this error is retryable (transient failure).
   */
  isRetryable(): boolean {
    return false;
  }
}

/**
 * GitHub API rate limit exceeded (HTTP 403 with X-RateLimit-Remaining: 0).
 * Retryable after the reset time.
 */
export class GitHubRateLimitError extends GitHubError {
  constructor(
    public readonly resetAt: Date,
    public readonly remaining: number,
    cause?: Error,
  ) {
    super(
      `GitHub API rate limit exceeded. Resets at ${resetAt.toISOString()}`,
      403,
      cause,
    );
    this.name = "GitHubRateLimitError";
  }

  isRetryable(): boolean {
    return true;
  }

  /**
   * Get the number of milliseconds until the rate limit resets.
   */
  getWaitMs(): number {
    return Math.max(0, this.resetAt.getTime() - Date.now());
  }
}

/**
 * GitHub secondary rate limit (abuse detection).
 * HTTP 403 with Retry-After header.
 */
export class GitHubSecondaryRateLimitError extends GitHubError {
  constructor(
    public readonly retryAfterSeconds: number,
    cause?: Error,
  ) {
    super(
      `GitHub secondary rate limit hit. Retry after ${retryAfterSeconds}s`,
      403,
      cause,
    );
    this.name = "GitHubSecondaryRateLimitError";
  }

  isRetryable(): boolean {
    return true;
  }

  /**
   * Get the number of milliseconds to wait before retrying.
   */
  getWaitMs(): number {
    return this.retryAfterSeconds * 1000;
  }
}

/**
 * GitHub server error (5xx status codes).
 * Transient errors that are retryable with backoff.
 */
export class GitHubServerError extends GitHubError {
  constructor(statusCode: number, message: string, cause?: Error) {
    super(message, statusCode, cause);
    this.name = "GitHubServerError";
  }

  isRetryable(): boolean {
    return true;
  }
}

/**
 * GitHub authentication error (HTTP 401).
 * Usually means the token is invalid or expired.
 */
export class GitHubAuthError extends GitHubError {
  constructor(message: string, cause?: Error) {
    super(message, 401, cause);
    this.name = "GitHubAuthError";
  }
}

/**
 * GitHub resource not found (HTTP 404).
 */
export class GitHubNotFoundError extends GitHubError {
  constructor(resource: string, cause?: Error) {
    super(`GitHub resource not found: ${resource}`, 404, cause);
    this.name = "GitHubNotFoundError";
  }
}

/**
 * GitHub permission denied (HTTP 403, non-rate-limit).
 * User doesn't have access to the resource.
 */
export class GitHubForbiddenError extends GitHubError {
  constructor(message: string, cause?: Error) {
    super(message, 403, cause);
    this.name = "GitHubForbiddenError";
  }
}

/**
 * Response headers from Octokit errors.
 */
interface OctokitErrorResponse {
  headers?: Record<string, string>;
}

/**
 * Octokit error shape with status and response.
 */
interface OctokitError extends Error {
  status?: number;
  response?: OctokitErrorResponse;
}

/**
 * Type guard to check if an error is an Octokit error.
 */
function isOctokitError(error: unknown): error is OctokitError {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof (error as OctokitError).status === "number"
  );
}

/**
 * Convert any error to a typed GitHubError.
 * Handles Octokit errors with special cases for rate limits.
 */
export function toGitHubError(error: unknown): GitHubError {
  // Already a GitHubError
  if (error instanceof GitHubError) {
    return error;
  }

  // Handle Octokit errors
  if (isOctokitError(error)) {
    const status = error.status;
    const headers = error.response?.headers ?? {};
    const message = error.message;

    // Check for primary rate limit (X-RateLimit-Remaining: 0)
    if (status === 403 && headers["x-ratelimit-remaining"] === "0") {
      const resetTimestamp =
        parseInt(headers["x-ratelimit-reset"] || "0", 10) * 1000;
      return new GitHubRateLimitError(new Date(resetTimestamp), 0, error);
    }

    // Check for secondary rate limit (Retry-After header)
    if (status === 403 && headers["retry-after"]) {
      const retryAfter = parseInt(headers["retry-after"], 10);
      return new GitHubSecondaryRateLimitError(retryAfter, error);
    }

    // Check for secondary rate limit in message
    if (
      status === 403 &&
      (message.toLowerCase().includes("secondary rate limit") ||
        message.toLowerCase().includes("abuse detection"))
    ) {
      // Default to 60 seconds if no Retry-After header
      return new GitHubSecondaryRateLimitError(60, error);
    }

    // Server errors (5xx)
    if (status !== undefined && status >= 500) {
      return new GitHubServerError(status, message, error);
    }

    // Authentication error
    if (status === 401) {
      return new GitHubAuthError(message, error);
    }

    // Not found
    if (status === 404) {
      return new GitHubNotFoundError(message, error);
    }

    // Other 403 (permission denied)
    if (status === 403) {
      return new GitHubForbiddenError(message, error);
    }

    // Other known status codes
    return new GitHubError(message, status, error);
  }

  // Generic error
  if (error instanceof Error) {
    return new GitHubError(error.message, undefined, error);
  }

  // Unknown error type
  return new GitHubError(String(error));
}

/**
 * Check if an error is a specific GitHub error type.
 */
export function isGitHubRateLimitError(
  error: unknown,
): error is GitHubRateLimitError {
  return error instanceof GitHubRateLimitError;
}

export function isGitHubSecondaryRateLimitError(
  error: unknown,
): error is GitHubSecondaryRateLimitError {
  return error instanceof GitHubSecondaryRateLimitError;
}

export function isGitHubServerError(
  error: unknown,
): error is GitHubServerError {
  return error instanceof GitHubServerError;
}

export function isGitHubAuthError(error: unknown): error is GitHubAuthError {
  return error instanceof GitHubAuthError;
}

export function isGitHubNotFoundError(
  error: unknown,
): error is GitHubNotFoundError {
  return error instanceof GitHubNotFoundError;
}

export function isGitHubForbiddenError(
  error: unknown,
): error is GitHubForbiddenError {
  return error instanceof GitHubForbiddenError;
}

/**
 * Check if any error is retryable.
 */
export function isRetryableGitHubError(error: unknown): boolean {
  if (error instanceof GitHubError) {
    return error.isRetryable();
  }
  return false;
}
