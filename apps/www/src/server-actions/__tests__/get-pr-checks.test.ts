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

const mockAggregatePRChecks = vi.fn();
const mockAggregatePRHeader = vi.fn();
vi.mock("@terragon/shared/github/pr-feedback", () => ({
  aggregatePRChecks: (...args: any[]) => mockAggregatePRChecks(...args),
  aggregatePRHeader: (...args: any[]) => mockAggregatePRHeader(...args),
}));

describe("getPRChecks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return PR checks data when given threadId with headSha", async () => {
    const { getThreadMinimal } = await import("@terragon/shared/model/threads");
    const { getOctokitForApp } = await import("@/lib/github");

    (getThreadMinimal as any).mockResolvedValue({
      githubRepoFullName: "owner/repo",
      githubPRNumber: 123,
    });
    (getOctokitForApp as any).mockResolvedValue({});

    mockAggregatePRChecks.mockResolvedValue({
      checks: [
        {
          id: 1,
          name: "CI",
          status: "completed",
          conclusion: "success",
          startedAt: "2024-01-01T00:00:00Z",
          completedAt: "2024-01-01T00:05:00Z",
          detailsUrl: "https://github.com/...",
        },
      ],
      coverageCheck: null,
      summary: {
        failingCount: 0,
        pendingCount: 0,
        passingCount: 1,
        hasCoverageCheck: false,
        coverageCheckPassed: null,
      },
    });

    const { getPRChecks } = await import("../get-pr-checks");
    const result = await getPRChecks({
      threadId: "test-thread-id",
      headSha: "abc123",
    });

    expect(result.success).toBe(true);
    expect(result.data?.checks).toHaveLength(1);
    expect(result.data?.summary.passingCount).toBe(1);
  });

  it("should fetch headSha from PR when not provided", async () => {
    const { getThreadMinimal } = await import("@terragon/shared/model/threads");
    const { getOctokitForApp } = await import("@/lib/github");

    (getThreadMinimal as any).mockResolvedValue({
      githubRepoFullName: "owner/repo",
      githubPRNumber: 123,
    });
    (getOctokitForApp as any).mockResolvedValue({});

    mockAggregatePRHeader.mockResolvedValue({
      headSha: "xyz789",
    });

    mockAggregatePRChecks.mockResolvedValue({
      checks: [],
      coverageCheck: null,
      summary: {
        failingCount: 0,
        pendingCount: 0,
        passingCount: 0,
        hasCoverageCheck: false,
        coverageCheckPassed: null,
      },
    });

    const { getPRChecks } = await import("../get-pr-checks");
    const result = await getPRChecks({ threadId: "test-thread-id" });

    expect(result.success).toBe(true);
    expect(mockAggregatePRHeader).toHaveBeenCalled();
    expect(mockAggregatePRChecks).toHaveBeenCalledWith(
      expect.anything(),
      "owner",
      "repo",
      "xyz789",
    );
  });

  it("should return PR checks data when given repoFullName and headSha", async () => {
    const { getOctokitForApp } = await import("@/lib/github");
    (getOctokitForApp as any).mockResolvedValue({});

    mockAggregatePRChecks.mockResolvedValue({
      checks: [
        {
          id: 1,
          name: "Tests",
          status: "completed",
          conclusion: "failure",
          startedAt: "2024-01-01T00:00:00Z",
          completedAt: "2024-01-01T00:10:00Z",
          detailsUrl: "https://github.com/...",
        },
      ],
      coverageCheck: {
        id: 2,
        name: "codecov",
        status: "completed",
        conclusion: "success",
        startedAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:02:00Z",
        detailsUrl: "https://codecov.io/...",
      },
      summary: {
        failingCount: 1,
        pendingCount: 0,
        passingCount: 1,
        hasCoverageCheck: true,
        coverageCheckPassed: true,
      },
    });

    const { getPRChecks } = await import("../get-pr-checks");
    const result = await getPRChecks({
      repoFullName: "owner/repo",
      headSha: "def456",
    });

    expect(result.success).toBe(true);
    expect(result.data?.summary.failingCount).toBe(1);
    expect(result.data?.coverageCheck).not.toBeNull();
    expect(result.data?.summary.hasCoverageCheck).toBe(true);
  });

  it("should return error when thread not found", async () => {
    const { getThreadMinimal } = await import("@terragon/shared/model/threads");
    (getThreadMinimal as any).mockResolvedValue(null);

    const { getPRChecks } = await import("../get-pr-checks");
    const result = await getPRChecks({ threadId: "non-existent-thread" });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("not found");
  });

  it("should return error when thread has no PR", async () => {
    const { getThreadMinimal } = await import("@terragon/shared/model/threads");
    (getThreadMinimal as any).mockResolvedValue({
      githubRepoFullName: "owner/repo",
      githubPRNumber: null,
    });

    const { getPRChecks } = await import("../get-pr-checks");
    const result = await getPRChecks({ threadId: "thread-without-pr" });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("does not have an associated PR");
  });

  it("should handle 404 errors from GitHub API", async () => {
    const { getOctokitForApp } = await import("@/lib/github");
    (getOctokitForApp as any).mockResolvedValue({});

    const error = new Error("Not Found");
    (error as any).status = 404;
    mockAggregatePRChecks.mockRejectedValue(error);

    const { getPRChecks } = await import("../get-pr-checks");
    const result = await getPRChecks({
      repoFullName: "owner/repo",
      headSha: "abc123",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("not found");
  });
});
