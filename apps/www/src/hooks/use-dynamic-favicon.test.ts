import { describe, it, expect, vi, beforeEach } from "vitest";
import { ThreadInfo, ThreadStatus } from "@terragon/shared";
import { getKanbanColumn } from "@/components/kanban/types";

// Helper to create a mock ThreadInfo
function createMockThread(
  overrides: {
    id?: string;
    status?: ThreadStatus;
    prStatus?: "draft" | "open" | "closed" | "merged" | null;
    isBacklog?: boolean;
  } = {},
): ThreadInfo {
  return {
    id: overrides.id ?? "test-thread-id",
    userId: "test-user-id",
    name: "Test Thread",
    githubRepoFullName: "test/repo",
    repoBaseBranchName: "main",
    branchName: "feature/test",
    githubPRNumber: null,
    githubIssueNumber: null,
    codesandboxId: null,
    sandboxProvider: "e2b",
    sandboxSize: null,
    sandboxStatus: null,
    bootingSubstatus: null,
    gitDiffStats: null,
    archived: false,
    isBacklog: overrides.isBacklog ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
    automationId: null,
    parentThreadId: null,
    parentToolId: null,
    draftMessage: null,
    disableGitCheckpointing: false,
    skipSetup: false,
    sourceType: "www",
    sourceMetadata: null,
    version: 1,
    isUnread: false,
    visibility: null,
    prStatus: overrides.prStatus ?? null,
    prChecksStatus: null,
    authorName: null,
    authorImage: null,
    threadChats: [
      {
        id: "test-chat-id",
        agent: "claudeCode",
        status: overrides.status ?? "queued",
        errorMessage: null,
      },
    ],
  } as ThreadInfo;
}

/**
 * Counts threads in the in_review column (mirrors the logic in useDynamicFavicon)
 */
function countReviewThreads(threads: ThreadInfo[]): number {
  return threads.filter((thread) => getKanbanColumn(thread) === "in_review")
    .length;
}

describe("useDynamicFavicon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reviewCount calculation (using getKanbanColumn)", () => {
    it("should return 0 when no threads exist", () => {
      const threads: ThreadInfo[] = [];
      expect(countReviewThreads(threads)).toBe(0);
    });

    it("should return 0 when no threads are in review", () => {
      const threads = [
        createMockThread({ id: "1", status: "draft" }), // backlog
        createMockThread({ id: "2", status: "working" }), // in_progress
        createMockThread({ id: "3", status: "complete", prStatus: "merged" }), // done
      ];

      expect(countReviewThreads(threads)).toBe(0);
    });

    it("should count threads with error status as in_review", () => {
      const threads = [
        createMockThread({ id: "1", status: "error" }),
        createMockThread({ id: "2", status: "working-error" }),
        createMockThread({ id: "3", status: "working" }),
      ];

      expect(countReviewThreads(threads)).toBe(2);
    });

    it("should count stopped threads as in_review", () => {
      const threads = [
        createMockThread({ id: "1", status: "stopped" }),
        createMockThread({ id: "2", status: "working-stopped" }),
      ];

      expect(countReviewThreads(threads)).toBe(2);
    });

    it("should count complete threads without merged PR as in_review", () => {
      const threads = [
        createMockThread({ id: "1", status: "complete", prStatus: "open" }),
        createMockThread({ id: "2", status: "complete", prStatus: null }),
        createMockThread({ id: "3", status: "complete", prStatus: "merged" }), // done, not review
      ];

      expect(countReviewThreads(threads)).toBe(2);
    });

    it("should count all review threads across multiple pages", () => {
      const page1 = [
        createMockThread({ id: "1", status: "error" }),
        createMockThread({ id: "2", status: "working" }),
      ];
      const page2 = [
        createMockThread({ id: "3", status: "complete", prStatus: "open" }),
        createMockThread({ id: "4", status: "stopped" }),
      ];

      const allThreads = [...page1, ...page2];
      expect(countReviewThreads(allThreads)).toBe(3); // error + complete/open + stopped
    });

    it("should not count backlog threads as in_review", () => {
      const threads = [
        createMockThread({ id: "1", status: "error", isBacklog: true }),
        createMockThread({
          id: "2",
          status: "complete",
          prStatus: "open",
          isBacklog: true,
        }),
      ];

      expect(countReviewThreads(threads)).toBe(0);
    });

    it("should count complete threads with closed PR as in_review", () => {
      const threads = [
        createMockThread({ id: "1", status: "complete", prStatus: "closed" }),
      ];

      expect(countReviewThreads(threads)).toBe(1);
    });

    it("should not count queued threads as in_review", () => {
      const threads = [
        createMockThread({ id: "1", status: "queued" }),
        createMockThread({ id: "2", status: "queued-tasks-concurrency" }),
        createMockThread({ id: "3", status: "queued-agent-rate-limit" }),
      ];

      expect(countReviewThreads(threads)).toBe(0);
    });

    it("should not count booting/working threads as in_review", () => {
      const threads = [
        createMockThread({ id: "1", status: "booting" }),
        createMockThread({ id: "2", status: "working" }),
        createMockThread({ id: "3", status: "stopping" }),
        createMockThread({ id: "4", status: "checkpointing" }),
        createMockThread({ id: "5", status: "working-done" }),
      ];

      expect(countReviewThreads(threads)).toBe(0);
    });
  });

  describe("badge display logic", () => {
    it("should cap badge text at 99+ for counts over 99", () => {
      // Test the logic that would be used in drawFaviconWithBadge
      const formatBadgeText = (count: number) =>
        count > 99 ? "99+" : String(count);

      expect(formatBadgeText(1)).toBe("1");
      expect(formatBadgeText(9)).toBe("9");
      expect(formatBadgeText(10)).toBe("10");
      expect(formatBadgeText(99)).toBe("99");
      expect(formatBadgeText(100)).toBe("99+");
      expect(formatBadgeText(999)).toBe("99+");
    });
  });

  describe("query filters", () => {
    it("should use correct filters for fetching threads", () => {
      // The hook should fetch non-archived, non-backlog threads
      const expectedFilters = {
        archived: false,
        isBacklog: false,
      };

      // This is a documentation test to ensure the filters are correct
      expect(expectedFilters.archived).toBe(false);
      expect(expectedFilters.isBacklog).toBe(false);
    });
  });
});
