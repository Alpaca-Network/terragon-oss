import { describe, expect, it, vi } from "vitest";
import { fetchPRWithMergeablePolling } from "@/lib/github-pulls";

describe("fetchPRWithMergeablePolling", () => {
  it("retries on network errors", async () => {
    vi.useFakeTimers();
    const mockOctokit = {
      rest: {
        pulls: {
          get: vi
            .fn()
            .mockRejectedValueOnce({ code: "ECONNRESET" })
            .mockResolvedValueOnce({
              data: { mergeable_state: "clean", mergeable: true },
            }),
        },
      },
    };

    try {
      const promise = fetchPRWithMergeablePolling({
        octokit: mockOctokit as any,
        owner: "owner",
        repo: "repo",
        prNumber: 123,
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(mockOctokit.rest.pulls.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        mergeable_state: "clean",
        mergeable: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry non-retryable errors", async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockRejectedValueOnce({ status: 404 }),
        },
      },
    };

    await expect(
      fetchPRWithMergeablePolling({
        octokit: mockOctokit as any,
        owner: "owner",
        repo: "repo",
        prNumber: 123,
      }),
    ).rejects.toEqual({ status: 404 });

    expect(mockOctokit.rest.pulls.get).toHaveBeenCalledTimes(1);
  });
});
