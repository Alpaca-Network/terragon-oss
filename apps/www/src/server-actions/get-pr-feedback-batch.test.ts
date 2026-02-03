import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ThreadPRInfo } from "./get-pr-feedback-batch";

// Mock the dependencies
vi.mock("@/lib/auth-server", () => ({
  userOnlyAction: vi.fn((fn) => {
    // Return a wrapper that simulates the server action behavior
    return async (...args: any[]) => {
      const userId = "test-user-id";
      try {
        const result = await fn(userId, ...args);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, errorMessage: (error as Error).message };
      }
    };
  }),
}));

vi.mock("@/lib/github", () => ({
  getOctokitForApp: vi.fn(),
  parseRepoFullName: vi.fn((fullName: string) => fullName.split("/")),
}));

const mockAggregatePRFeedback = vi.fn();
vi.mock("@terragon/shared/github/pr-feedback", () => ({
  aggregatePRFeedback: (...args: any[]) => mockAggregatePRFeedback(...args),
  createFeedbackSummary: vi.fn(() => ({
    unresolvedCommentCount: 0,
    resolvedCommentCount: 0,
    failingCheckCount: 0,
    pendingCheckCount: 0,
    passingCheckCount: 1,
    hasCoverageCheck: false,
    coverageCheckPassed: null,
    hasConflicts: false,
    isMergeable: true,
  })),
}));

describe("getPRFeedbackBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty object for empty thread infos", async () => {
    // Dynamically import to get fresh mocks
    const { getPRFeedbackBatch } = await import("./get-pr-feedback-batch");

    const result = await getPRFeedbackBatch([]);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it("should return null for threads without PRs", async () => {
    const { getPRFeedbackBatch } = await import("./get-pr-feedback-batch");

    const threadInfos: ThreadPRInfo[] = [
      {
        id: "thread-1",
        githubRepoFullName: "owner/repo",
        githubPRNumber: null, // No PR
      },
    ];

    const result = await getPRFeedbackBatch(threadInfos);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      "thread-1": null,
    });
  });

  it("should fetch PR feedback for threads with PRs", async () => {
    const { getOctokitForApp } = await import("@/lib/github");
    (getOctokitForApp as any).mockResolvedValue({});

    mockAggregatePRFeedback.mockResolvedValue({
      prNumber: 123,
      repoFullName: "owner/repo",
      prUrl: "https://github.com/owner/repo/pull/123",
      prTitle: "Test PR",
      prState: "open",
      baseBranch: "main",
      headBranch: "feature",
      headSha: "abc123",
      comments: { unresolved: [], resolved: [] },
      checks: [],
      coverageCheck: null,
      mergeableState: "clean",
      hasConflicts: false,
      isMergeable: true,
    });

    const { getPRFeedbackBatch } = await import("./get-pr-feedback-batch");

    const threadInfos: ThreadPRInfo[] = [
      {
        id: "thread-1",
        githubRepoFullName: "owner/repo",
        githubPRNumber: 123,
      },
    ];

    const result = await getPRFeedbackBatch(threadInfos);

    expect(result.success).toBe(true);
    expect(result.data!["thread-1"]).not.toBeNull();
    expect(result.data!["thread-1"]?.feedback.prNumber).toBe(123);
  });

  it("should handle errors gracefully and continue with other threads", async () => {
    const { getOctokitForApp } = await import("@/lib/github");
    (getOctokitForApp as any).mockResolvedValue({});

    mockAggregatePRFeedback
      .mockResolvedValueOnce({
        prNumber: 123,
        repoFullName: "owner/repo",
        prUrl: "https://github.com/owner/repo/pull/123",
        prTitle: "Test PR",
        prState: "open",
        baseBranch: "main",
        headBranch: "feature",
        headSha: "abc123",
        comments: { unresolved: [], resolved: [] },
        checks: [],
        coverageCheck: null,
        mergeableState: "clean",
        hasConflicts: false,
        isMergeable: true,
      })
      .mockRejectedValueOnce(new Error("GitHub API error"));

    const { getPRFeedbackBatch } = await import("./get-pr-feedback-batch");

    const threadInfos: ThreadPRInfo[] = [
      {
        id: "thread-1",
        githubRepoFullName: "owner/repo",
        githubPRNumber: 123,
      },
      {
        id: "thread-2",
        githubRepoFullName: "owner/repo",
        githubPRNumber: 456,
      },
    ];

    const result = await getPRFeedbackBatch(threadInfos);

    expect(result.success).toBe(true);
    // First thread should have data
    expect(result.data!["thread-1"]).not.toBeNull();
    // Second thread should be null due to error
    expect(result.data!["thread-2"]).toBeNull();
  });

  it("should limit batch size to MAX_BATCH_SIZE", async () => {
    const { getOctokitForApp } = await import("@/lib/github");
    (getOctokitForApp as any).mockResolvedValue({});

    // Create 15 thread infos (more than MAX_BATCH_SIZE of 10)
    const threadInfos: ThreadPRInfo[] = Array.from({ length: 15 }, (_, i) => ({
      id: `thread-${i}`,
      githubRepoFullName: "owner/repo",
      githubPRNumber: null, // No PR to simplify test
    }));

    const { getPRFeedbackBatch } = await import("./get-pr-feedback-batch");

    const result = await getPRFeedbackBatch(threadInfos);

    expect(result.success).toBe(true);
    // Should only process first 10 threads
    expect(Object.keys(result.data!).length).toBe(10);
  });
});
