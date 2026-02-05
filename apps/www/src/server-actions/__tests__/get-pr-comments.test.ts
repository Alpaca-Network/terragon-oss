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

const mockAggregatePRComments = vi.fn();
vi.mock("@terragon/shared/github/pr-feedback", () => ({
  aggregatePRComments: (...args: any[]) => mockAggregatePRComments(...args),
}));

describe("getPRComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return PR comments data when given threadId", async () => {
    const { getThreadMinimal } = await import("@terragon/shared/model/threads");
    const { getOctokitForApp } = await import("@/lib/github");

    (getThreadMinimal as any).mockResolvedValue({
      githubRepoFullName: "owner/repo",
      githubPRNumber: 123,
    });
    (getOctokitForApp as any).mockResolvedValue({});

    mockAggregatePRComments.mockResolvedValue({
      comments: {
        unresolved: [
          {
            id: "thread-1",
            isResolved: false,
            comments: [
              {
                id: 1,
                body: "Please fix this",
                path: "src/file.ts",
                line: 10,
                author: { login: "reviewer", avatarUrl: "" },
                createdAt: "2024-01-01T00:00:00Z",
                updatedAt: "2024-01-01T00:00:00Z",
                htmlUrl: "https://github.com/...",
              },
            ],
          },
        ],
        resolved: [],
      },
      summary: {
        unresolvedCount: 1,
        resolvedCount: 0,
      },
    });

    const { getPRComments } = await import("../get-pr-comments");
    const result = await getPRComments({ threadId: "test-thread-id" });

    expect(result.success).toBe(true);
    expect(result.data?.comments.unresolved).toHaveLength(1);
    expect(result.data?.summary.unresolvedCount).toBe(1);
  });

  it("should return PR comments data when given repoFullName and prNumber", async () => {
    const { getOctokitForApp } = await import("@/lib/github");
    (getOctokitForApp as any).mockResolvedValue({});

    mockAggregatePRComments.mockResolvedValue({
      comments: {
        unresolved: [],
        resolved: [
          {
            id: "thread-1",
            isResolved: true,
            comments: [
              {
                id: 1,
                body: "Fixed!",
                path: "src/file.ts",
                line: 10,
                author: { login: "author", avatarUrl: "" },
                createdAt: "2024-01-01T00:00:00Z",
                updatedAt: "2024-01-02T00:00:00Z",
                htmlUrl: "https://github.com/...",
              },
            ],
          },
        ],
      },
      summary: {
        unresolvedCount: 0,
        resolvedCount: 1,
      },
    });

    const { getPRComments } = await import("../get-pr-comments");
    const result = await getPRComments({
      repoFullName: "owner/repo",
      prNumber: 456,
    });

    expect(result.success).toBe(true);
    expect(result.data?.comments.resolved).toHaveLength(1);
    expect(result.data?.summary.resolvedCount).toBe(1);
  });

  it("should return error when thread not found", async () => {
    const { getThreadMinimal } = await import("@terragon/shared/model/threads");
    (getThreadMinimal as any).mockResolvedValue(null);

    const { getPRComments } = await import("../get-pr-comments");
    const result = await getPRComments({ threadId: "non-existent-thread" });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("not found");
  });

  it("should return error when thread has no PR", async () => {
    const { getThreadMinimal } = await import("@terragon/shared/model/threads");
    (getThreadMinimal as any).mockResolvedValue({
      githubRepoFullName: "owner/repo",
      githubPRNumber: null,
    });

    const { getPRComments } = await import("../get-pr-comments");
    const result = await getPRComments({ threadId: "thread-without-pr" });

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
    mockAggregatePRComments.mockRejectedValue(error);

    const { getPRComments } = await import("../get-pr-comments");
    const result = await getPRComments({ threadId: "test-thread-id" });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("not found");
  });
});
