import { describe, it, expect, vi } from "vitest";
import { retryGitHubRequest, withGitHubRetry } from "./github-retry";
import {
  GitHubRateLimitError,
  GitHubSecondaryRateLimitError,
  GitHubServerError,
  GitHubAuthError,
} from "./github-errors";

describe("retryGitHubRequest", () => {
  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await retryGitHubRequest(fn, { label: "test" });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable error and succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new GitHubServerError(500, "Server error"))
      .mockResolvedValueOnce("success");

    const result = await retryGitHubRequest(fn, {
      label: "test",
      baseDelayMs: 10, // Use short delays for tests
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should throw immediately on non-retryable error", async () => {
    const authError = new GitHubAuthError("Bad credentials");
    const fn = vi.fn().mockRejectedValue(authError);

    await expect(retryGitHubRequest(fn, { label: "test" })).rejects.toThrow(
      authError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should respect maxAttempts", async () => {
    const serverError = new GitHubServerError(500, "Server error");
    const fn = vi.fn().mockRejectedValue(serverError);

    await expect(
      retryGitHubRequest(fn, {
        label: "test",
        maxAttempts: 3,
        baseDelayMs: 10,
      }),
    ).rejects.toThrow(serverError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should use exponential backoff for server errors", async () => {
    const serverError = new GitHubServerError(500, "Server error");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(serverError)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce("success");

    const result = await retryGitHubRequest(fn, {
      label: "test",
      baseDelayMs: 10,
      maxAttempts: 4,
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should convert non-GitHubError to Error", async () => {
    const plainError = new Error("Plain error");
    const fn = vi.fn().mockRejectedValue(plainError);

    await expect(
      retryGitHubRequest(fn, { label: "test", maxAttempts: 1 }),
    ).rejects.toThrow("Plain error");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should handle string errors", async () => {
    const fn = vi.fn().mockRejectedValue("String error");

    await expect(
      retryGitHubRequest(fn, { label: "test", maxAttempts: 1 }),
    ).rejects.toThrow("String error");
  });

  it("should use default options when not specified", async () => {
    const serverError = new GitHubServerError(500, "Server error");
    const fn = vi.fn().mockRejectedValue(serverError);

    await expect(
      retryGitHubRequest(fn, { label: "test", baseDelayMs: 10 }),
    ).rejects.toThrow(serverError);
    // Default maxAttempts is 3
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should handle rate limit errors", async () => {
    // Use a past reset time so getWaitMs returns 0
    const resetAt = new Date(Date.now() - 1000);
    const rateLimitError = new GitHubRateLimitError(resetAt, 0);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce("success");

    const result = await retryGitHubRequest(fn, {
      label: "test",
      maxDelayMs: 100,
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should handle secondary rate limit errors", async () => {
    // Use a very short retry-after for testing
    const secondaryError = new GitHubSecondaryRateLimitError(0);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(secondaryError)
      .mockResolvedValueOnce("success");

    const result = await retryGitHubRequest(fn, {
      label: "test",
      maxDelayMs: 100,
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("withGitHubRetry", () => {
  it("should wrap function with retry logic", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const wrapped = withGitHubRetry(fn, { label: "test" });

    const result = await wrapped("arg1", "arg2");

    expect(result).toBe("result");
    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("should retry wrapped function on failure", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new GitHubServerError(500, "Error"))
      .mockResolvedValueOnce("success");

    const wrapped = withGitHubRetry(fn, { label: "test", baseDelayMs: 10 });
    const result = await wrapped();

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should preserve function arguments across retries", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new GitHubServerError(500, "Error"))
      .mockImplementationOnce((a: string, b: number) =>
        Promise.resolve(`${a}-${b}`),
      );

    const wrapped = withGitHubRetry(fn, { label: "test", baseDelayMs: 10 });
    const result = await wrapped("test", 123);

    expect(result).toBe("test-123");
    expect(fn).toHaveBeenNthCalledWith(1, "test", 123);
    expect(fn).toHaveBeenNthCalledWith(2, "test", 123);
  });
});
