import { describe, it, expect } from "vitest";
import {
  GitHubError,
  GitHubRateLimitError,
  GitHubSecondaryRateLimitError,
  GitHubServerError,
  GitHubAuthError,
  GitHubNotFoundError,
  GitHubForbiddenError,
  toGitHubError,
  isGitHubRateLimitError,
  isGitHubSecondaryRateLimitError,
  isGitHubServerError,
  isGitHubAuthError,
  isGitHubNotFoundError,
  isGitHubForbiddenError,
  isRetryableGitHubError,
} from "./github-errors";

describe("GitHubError", () => {
  it("should create a base error with message", () => {
    const error = new GitHubError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("GitHubError");
    expect(error.statusCode).toBeUndefined();
    expect(error.isRetryable()).toBe(false);
  });

  it("should create an error with status code", () => {
    const error = new GitHubError("Test error", 400);
    expect(error.statusCode).toBe(400);
  });

  it("should create an error with cause", () => {
    const cause = new Error("Original error");
    const error = new GitHubError("Test error", 400, cause);
    expect(error.cause).toBe(cause);
  });
});

describe("GitHubRateLimitError", () => {
  it("should create a rate limit error", () => {
    const resetAt = new Date("2024-01-01T12:00:00Z");
    const error = new GitHubRateLimitError(resetAt, 0);
    expect(error.name).toBe("GitHubRateLimitError");
    expect(error.statusCode).toBe(403);
    expect(error.resetAt).toBe(resetAt);
    expect(error.remaining).toBe(0);
    expect(error.isRetryable()).toBe(true);
  });

  it("should calculate wait time", () => {
    const futureDate = new Date(Date.now() + 60000); // 1 minute in future
    const error = new GitHubRateLimitError(futureDate, 0);
    const waitMs = error.getWaitMs();
    expect(waitMs).toBeGreaterThan(0);
    expect(waitMs).toBeLessThanOrEqual(60000);
  });

  it("should return 0 for past reset time", () => {
    const pastDate = new Date(Date.now() - 60000); // 1 minute in past
    const error = new GitHubRateLimitError(pastDate, 0);
    expect(error.getWaitMs()).toBe(0);
  });
});

describe("GitHubSecondaryRateLimitError", () => {
  it("should create a secondary rate limit error", () => {
    const error = new GitHubSecondaryRateLimitError(60);
    expect(error.name).toBe("GitHubSecondaryRateLimitError");
    expect(error.statusCode).toBe(403);
    expect(error.retryAfterSeconds).toBe(60);
    expect(error.isRetryable()).toBe(true);
  });

  it("should calculate wait time in milliseconds", () => {
    const error = new GitHubSecondaryRateLimitError(30);
    expect(error.getWaitMs()).toBe(30000);
  });
});

describe("GitHubServerError", () => {
  it("should create a server error", () => {
    const error = new GitHubServerError(500, "Internal Server Error");
    expect(error.name).toBe("GitHubServerError");
    expect(error.statusCode).toBe(500);
    expect(error.message).toBe("Internal Server Error");
    expect(error.isRetryable()).toBe(true);
  });

  it("should handle various 5xx codes", () => {
    const error502 = new GitHubServerError(502, "Bad Gateway");
    const error503 = new GitHubServerError(503, "Service Unavailable");
    expect(error502.isRetryable()).toBe(true);
    expect(error503.isRetryable()).toBe(true);
  });
});

describe("GitHubAuthError", () => {
  it("should create an auth error", () => {
    const error = new GitHubAuthError("Bad credentials");
    expect(error.name).toBe("GitHubAuthError");
    expect(error.statusCode).toBe(401);
    expect(error.isRetryable()).toBe(false);
  });
});

describe("GitHubNotFoundError", () => {
  it("should create a not found error", () => {
    const error = new GitHubNotFoundError("Repository not found");
    expect(error.name).toBe("GitHubNotFoundError");
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe(
      "GitHub resource not found: Repository not found",
    );
    expect(error.isRetryable()).toBe(false);
  });
});

describe("GitHubForbiddenError", () => {
  it("should create a forbidden error", () => {
    const error = new GitHubForbiddenError("Access denied");
    expect(error.name).toBe("GitHubForbiddenError");
    expect(error.statusCode).toBe(403);
    expect(error.isRetryable()).toBe(false);
  });
});

describe("toGitHubError", () => {
  it("should return GitHubError unchanged", () => {
    const original = new GitHubError("Original");
    const result = toGitHubError(original);
    expect(result).toBe(original);
  });

  it("should convert rate limit error from Octokit", () => {
    const octokitError = Object.assign(new Error("API rate limit exceeded"), {
      status: 403,
      response: {
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
        },
      },
    });
    const result = toGitHubError(octokitError);
    expect(result).toBeInstanceOf(GitHubRateLimitError);
    expect(result.isRetryable()).toBe(true);
  });

  it("should convert secondary rate limit error from Octokit", () => {
    const octokitError = Object.assign(new Error("Secondary rate limit"), {
      status: 403,
      response: {
        headers: {
          "retry-after": "60",
        },
      },
    });
    const result = toGitHubError(octokitError);
    expect(result).toBeInstanceOf(GitHubSecondaryRateLimitError);
    expect((result as GitHubSecondaryRateLimitError).retryAfterSeconds).toBe(
      60,
    );
  });

  it("should detect secondary rate limit from message", () => {
    const octokitError = Object.assign(
      new Error("You have exceeded a secondary rate limit"),
      {
        status: 403,
        response: { headers: {} },
      },
    );
    const result = toGitHubError(octokitError);
    expect(result).toBeInstanceOf(GitHubSecondaryRateLimitError);
  });

  it("should convert server error", () => {
    const octokitError = Object.assign(new Error("Internal Server Error"), {
      status: 500,
      response: { headers: {} },
    });
    const result = toGitHubError(octokitError);
    expect(result).toBeInstanceOf(GitHubServerError);
    expect(result.statusCode).toBe(500);
    expect(result.isRetryable()).toBe(true);
  });

  it("should convert auth error", () => {
    const octokitError = Object.assign(new Error("Bad credentials"), {
      status: 401,
      response: { headers: {} },
    });
    const result = toGitHubError(octokitError);
    expect(result).toBeInstanceOf(GitHubAuthError);
  });

  it("should convert not found error", () => {
    const octokitError = Object.assign(new Error("Not Found"), {
      status: 404,
      response: { headers: {} },
    });
    const result = toGitHubError(octokitError);
    expect(result).toBeInstanceOf(GitHubNotFoundError);
  });

  it("should convert other 403 to forbidden error", () => {
    const octokitError = Object.assign(new Error("Access denied"), {
      status: 403,
      response: { headers: {} },
    });
    const result = toGitHubError(octokitError);
    expect(result).toBeInstanceOf(GitHubForbiddenError);
  });

  it("should convert generic Error", () => {
    const error = new Error("Some error");
    const result = toGitHubError(error);
    expect(result).toBeInstanceOf(GitHubError);
    expect(result.message).toBe("Some error");
  });

  it("should convert string to GitHubError", () => {
    const result = toGitHubError("String error");
    expect(result).toBeInstanceOf(GitHubError);
    expect(result.message).toBe("String error");
  });
});

describe("type guards", () => {
  it("isGitHubRateLimitError should identify rate limit errors", () => {
    const error = new GitHubRateLimitError(new Date(), 0);
    expect(isGitHubRateLimitError(error)).toBe(true);
    expect(isGitHubRateLimitError(new GitHubError("test"))).toBe(false);
    expect(isGitHubRateLimitError(new Error("test"))).toBe(false);
  });

  it("isGitHubSecondaryRateLimitError should identify secondary rate limit errors", () => {
    const error = new GitHubSecondaryRateLimitError(60);
    expect(isGitHubSecondaryRateLimitError(error)).toBe(true);
    expect(isGitHubSecondaryRateLimitError(new GitHubError("test"))).toBe(
      false,
    );
  });

  it("isGitHubServerError should identify server errors", () => {
    const error = new GitHubServerError(500, "test");
    expect(isGitHubServerError(error)).toBe(true);
    expect(isGitHubServerError(new GitHubError("test"))).toBe(false);
  });

  it("isGitHubAuthError should identify auth errors", () => {
    const error = new GitHubAuthError("test");
    expect(isGitHubAuthError(error)).toBe(true);
    expect(isGitHubAuthError(new GitHubError("test"))).toBe(false);
  });

  it("isGitHubNotFoundError should identify not found errors", () => {
    const error = new GitHubNotFoundError("test");
    expect(isGitHubNotFoundError(error)).toBe(true);
    expect(isGitHubNotFoundError(new GitHubError("test"))).toBe(false);
  });

  it("isGitHubForbiddenError should identify forbidden errors", () => {
    const error = new GitHubForbiddenError("test");
    expect(isGitHubForbiddenError(error)).toBe(true);
    expect(isGitHubForbiddenError(new GitHubError("test"))).toBe(false);
  });
});

describe("isRetryableGitHubError", () => {
  it("should return true for rate limit errors", () => {
    expect(
      isRetryableGitHubError(new GitHubRateLimitError(new Date(), 0)),
    ).toBe(true);
  });

  it("should return true for secondary rate limit errors", () => {
    expect(isRetryableGitHubError(new GitHubSecondaryRateLimitError(60))).toBe(
      true,
    );
  });

  it("should return true for server errors", () => {
    expect(isRetryableGitHubError(new GitHubServerError(500, "test"))).toBe(
      true,
    );
  });

  it("should return false for auth errors", () => {
    expect(isRetryableGitHubError(new GitHubAuthError("test"))).toBe(false);
  });

  it("should return false for not found errors", () => {
    expect(isRetryableGitHubError(new GitHubNotFoundError("test"))).toBe(false);
  });

  it("should return false for forbidden errors", () => {
    expect(isRetryableGitHubError(new GitHubForbiddenError("test"))).toBe(
      false,
    );
  });

  it("should return false for base GitHubError", () => {
    expect(isRetryableGitHubError(new GitHubError("test"))).toBe(false);
  });

  it("should return false for non-GitHubError", () => {
    expect(isRetryableGitHubError(new Error("test"))).toBe(false);
    expect(isRetryableGitHubError("string")).toBe(false);
    expect(isRetryableGitHubError(null)).toBe(false);
  });
});
