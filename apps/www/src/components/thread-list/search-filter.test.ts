import { describe, it, expect } from "vitest";
import { ThreadInfo } from "@terragon/shared";

// Helper to create a minimal thread info object for testing
function createMockThreadInfo(overrides: Partial<ThreadInfo> = {}): ThreadInfo {
  return {
    id: "test-thread-id",
    userId: "test-user-id",
    name: "Test Thread",
    githubRepoFullName: "test/repo",
    repoBaseBranchName: "main",
    branchName: null,
    githubPRNumber: null,
    githubIssueNumber: null,
    codesandboxId: null,
    sandboxProvider: "e2b",
    sandboxSize: null,
    sandboxStatus: null,
    bootingSubstatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archived: false,
    isBacklog: false,
    automationId: null,
    parentThreadId: null,
    parentToolId: null,
    draftMessage: null,
    disableGitCheckpointing: false,
    skipSetup: false,
    autoFixFeedback: false,
    autoMergePR: false,
    autoFixIterationCount: 0,
    autoFixQueuedAt: null,
    sourceType: null,
    sourceMetadata: null,
    version: 0,
    gitDiffStats: null,
    isUnread: false,
    visibility: null,
    prStatus: null,
    prChecksStatus: null,
    authorName: null,
    authorImage: null,
    threadChats: [],
    lastUsedModel: null,
    ...overrides,
  };
}

// This mirrors the search filtering logic in main.tsx
function matchesSearchQuery(
  thread: ThreadInfo,
  searchQuery: string | undefined,
): boolean {
  const normalizedSearchQuery = searchQuery?.toLowerCase().trim() || "";
  if (!normalizedSearchQuery) {
    return true;
  }
  const threadName = thread.name?.toLowerCase() || "";
  const repoName = thread.githubRepoFullName?.toLowerCase() || "";
  return (
    threadName.includes(normalizedSearchQuery) ||
    repoName.includes(normalizedSearchQuery)
  );
}

describe("Thread Search Filtering", () => {
  describe("matchesSearchQuery", () => {
    it("should match all threads when search query is undefined", () => {
      const thread = createMockThreadInfo({ name: "Fix bug in login" });
      expect(matchesSearchQuery(thread, undefined)).toBe(true);
    });

    it("should match all threads when search query is empty string", () => {
      const thread = createMockThreadInfo({ name: "Fix bug in login" });
      expect(matchesSearchQuery(thread, "")).toBe(true);
    });

    it("should match all threads when search query is only whitespace", () => {
      const thread = createMockThreadInfo({ name: "Fix bug in login" });
      expect(matchesSearchQuery(thread, "   ")).toBe(true);
    });

    it("should match thread by name (case insensitive)", () => {
      const thread = createMockThreadInfo({ name: "Fix Bug in Login" });
      expect(matchesSearchQuery(thread, "bug")).toBe(true);
      expect(matchesSearchQuery(thread, "BUG")).toBe(true);
      expect(matchesSearchQuery(thread, "Bug")).toBe(true);
    });

    it("should match thread by partial name", () => {
      const thread = createMockThreadInfo({
        name: "Implement user authentication feature",
      });
      expect(matchesSearchQuery(thread, "auth")).toBe(true);
      expect(matchesSearchQuery(thread, "user auth")).toBe(true);
      expect(matchesSearchQuery(thread, "feature")).toBe(true);
    });

    it("should match thread by repository name (case insensitive)", () => {
      const thread = createMockThreadInfo({
        name: "Some task",
        githubRepoFullName: "acme-corp/my-project",
      });
      expect(matchesSearchQuery(thread, "acme")).toBe(true);
      expect(matchesSearchQuery(thread, "ACME")).toBe(true);
      expect(matchesSearchQuery(thread, "my-project")).toBe(true);
      expect(matchesSearchQuery(thread, "acme-corp")).toBe(true);
    });

    it("should match thread by partial repository name", () => {
      const thread = createMockThreadInfo({
        name: "Some task",
        githubRepoFullName: "organization/repository-name",
      });
      expect(matchesSearchQuery(thread, "org")).toBe(true);
      expect(matchesSearchQuery(thread, "repo")).toBe(true);
      expect(matchesSearchQuery(thread, "name")).toBe(true);
    });

    it("should not match when search query is not in name or repo", () => {
      const thread = createMockThreadInfo({
        name: "Fix bug in login",
        githubRepoFullName: "acme/project",
      });
      expect(matchesSearchQuery(thread, "feature")).toBe(false);
      expect(matchesSearchQuery(thread, "xyz")).toBe(false);
      expect(matchesSearchQuery(thread, "other-repo")).toBe(false);
    });

    it("should handle threads with null name", () => {
      const thread = createMockThreadInfo({
        name: null as unknown as string,
        githubRepoFullName: "acme/project",
      });
      expect(matchesSearchQuery(thread, "acme")).toBe(true);
      expect(matchesSearchQuery(thread, "fix")).toBe(false);
    });

    it("should handle threads with empty repo name", () => {
      const thread = createMockThreadInfo({
        name: "Fix bug in login",
        githubRepoFullName: "",
      });
      expect(matchesSearchQuery(thread, "bug")).toBe(true);
      expect(matchesSearchQuery(thread, "acme")).toBe(false);
    });

    it("should handle search queries with leading/trailing whitespace", () => {
      const thread = createMockThreadInfo({ name: "Fix bug in login" });
      expect(matchesSearchQuery(thread, "  bug  ")).toBe(true);
      expect(matchesSearchQuery(thread, "\tbug\n")).toBe(true);
    });

    it("should handle special characters in search query", () => {
      const thread = createMockThreadInfo({
        name: "Fix bug [high priority]",
        githubRepoFullName: "acme-corp/my_project",
      });
      expect(matchesSearchQuery(thread, "[high")).toBe(true);
      expect(matchesSearchQuery(thread, "acme-")).toBe(true);
      expect(matchesSearchQuery(thread, "_project")).toBe(true);
    });
  });

  describe("Filtering multiple threads", () => {
    const threads = [
      createMockThreadInfo({
        id: "1",
        name: "Add user authentication",
        githubRepoFullName: "acme/frontend",
      }),
      createMockThreadInfo({
        id: "2",
        name: "Fix login bug",
        githubRepoFullName: "acme/backend",
      }),
      createMockThreadInfo({
        id: "3",
        name: "Update documentation",
        githubRepoFullName: "acme/docs",
      }),
      createMockThreadInfo({
        id: "4",
        name: "Refactor database queries",
        githubRepoFullName: "other-org/db-service",
      }),
    ];

    it("should filter threads by name", () => {
      const filtered = threads.filter((t) => matchesSearchQuery(t, "login"));
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.id).toBe("2");
    });

    it("should filter threads by repository", () => {
      const filtered = threads.filter((t) => matchesSearchQuery(t, "acme"));
      expect(filtered).toHaveLength(3);
      expect(filtered.map((t) => t.id)).toEqual(["1", "2", "3"]);
    });

    it("should return all threads with empty search", () => {
      const filtered = threads.filter((t) => matchesSearchQuery(t, ""));
      expect(filtered).toHaveLength(4);
    });

    it("should return empty array when no matches", () => {
      const filtered = threads.filter((t) =>
        matchesSearchQuery(t, "nonexistent"),
      );
      expect(filtered).toHaveLength(0);
    });

    it("should match threads by multiple criteria", () => {
      const filtered = threads.filter((t) => matchesSearchQuery(t, "doc"));
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.id).toBe("3");
    });
  });
});
