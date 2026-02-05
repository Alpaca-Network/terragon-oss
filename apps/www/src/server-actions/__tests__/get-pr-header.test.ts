import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the dependencies
vi.mock("@/lib/auth-server", () => ({
  userOnlyAction: vi.fn((fn) => {
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

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/github", () => ({
  getOctokitForApp: vi.fn(),
  parseRepoFullName: vi.fn((fullName: string) => fullName.split("/")),
}));

vi.mock("@terragon/shared/model/threads", () => ({
  getThreadMinimal: vi.fn(),
}));

const mockAggregatePRHeader = vi.fn();
vi.mock("@terragon/shared/github/pr-feedback", () => ({
  aggregatePRHeader: (...args: any[]) => mockAggregatePRHeader(...args),
}));

describe("getPRHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return PR header data when given threadId", async () => {
    const { getThreadMinimal } = await import("@terragon/shared/model/threads");
    const { getOctokitForApp } = await import("@/lib/github");

    (getThreadMinimal as any).mockResolvedValue({
      githubRepoFullName: "owner/repo",
      githubPRNumber: 123,
    });
    (getOctokitForApp as any).mockResolvedValue({});

    mockAggregatePRHeader.mockResolvedValue({
      prNumber: 123,
      repoFullName: "owner/repo",
      prUrl: "https://github.com/owner/repo/pull/123",
      prTitle: "Test PR",
      prState: "open",
      baseBranch: "main",
      headBranch: "feature",
      headSha: "abc123",
      mergeableState: "clean",
      hasConflicts: false,
      isMergeable: true,
      isAutoMergeEnabled: false,
    });

    const { getPRHeader } = await import("../get-pr-header");
    const result = await getPRHeader({ threadId: "test-thread-id" });

    expect(result.success).toBe(true);
    expect(result.data?.prNumber).toBe(123);
    expect(result.data?.prTitle).toBe("Test PR");
    expect(result.data?.headSha).toBe("abc123");
  });

  it("should return PR header data when given repoFullName and prNumber", async () => {
    const { getOctokitForApp } = await import("@/lib/github");
    (getOctokitForApp as any).mockResolvedValue({});

    mockAggregatePRHeader.mockResolvedValue({
      prNumber: 456,
      repoFullName: "owner/repo",
      prUrl: "https://github.com/owner/repo/pull/456",
      prTitle: "Another PR",
      prState: "open",
      baseBranch: "main",
      headBranch: "feature-2",
      headSha: "def456",
      mergeableState: "dirty",
      hasConflicts: true,
      isMergeable: false,
      isAutoMergeEnabled: true,
    });

    const { getPRHeader } = await import("../get-pr-header");
    const result = await getPRHeader({
      repoFullName: "owner/repo",
      prNumber: 456,
    });

    expect(result.success).toBe(true);
    expect(result.data?.prNumber).toBe(456);
    expect(result.data?.hasConflicts).toBe(true);
    expect(result.data?.isAutoMergeEnabled).toBe(true);
  });

  it("should return error when thread not found", async () => {
    const { getThreadMinimal } = await import("@terragon/shared/model/threads");
    (getThreadMinimal as any).mockResolvedValue(null);

    const { getPRHeader } = await import("../get-pr-header");
    const result = await getPRHeader({ threadId: "non-existent-thread" });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("not found");
  });

  it("should return error when thread has no PR", async () => {
    const { getThreadMinimal } = await import("@terragon/shared/model/threads");
    (getThreadMinimal as any).mockResolvedValue({
      githubRepoFullName: "owner/repo",
      githubPRNumber: null,
    });

    const { getPRHeader } = await import("../get-pr-header");
    const result = await getPRHeader({ threadId: "thread-without-pr" });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("does not have an associated PR");
  });

  it("should handle 404 errors from GitHub API", async () => {
    const { getThreadMinimal } = await import("@terragon/shared/model/threads");
    const { getOctokitForApp } = await import("@/lib/github");

    (getThreadMinimal as any).mockResolvedValue({
      githubRepoFullName: "owner/repo",
      githubPRNumber: 999,
    });
    (getOctokitForApp as any).mockResolvedValue({});

    const error = new Error("Not Found");
    (error as any).status = 404;
    mockAggregatePRHeader.mockRejectedValue(error);

    const { getPRHeader } = await import("../get-pr-header");
    const result = await getPRHeader({ threadId: "test-thread-id" });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("not found");
  });
});
