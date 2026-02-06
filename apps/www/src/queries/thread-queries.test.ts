import { describe, it, expect } from "vitest";
import {
  isValidThreadListFilter,
  isMatchingThreadForFilter,
  ThreadListFilters,
  threadQueryOptions,
} from "./thread-queries";
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

describe("isValidThreadListFilter", () => {
  it("should return true for valid filters", () => {
    expect(isValidThreadListFilter({ archived: true })).toBe(true);
    expect(isValidThreadListFilter({ archived: false })).toBe(true);
    expect(isValidThreadListFilter({ isBacklog: true })).toBe(true);
    expect(isValidThreadListFilter({ isBacklog: false })).toBe(true);
    expect(isValidThreadListFilter({ automationId: "test-id" })).toBe(true);
    expect(isValidThreadListFilter({})).toBe(true);
    expect(
      isValidThreadListFilter({
        archived: false,
        isBacklog: true,
        automationId: "test",
      }),
    ).toBe(true);
  });

  it("should return false for invalid filters", () => {
    expect(isValidThreadListFilter(null)).toBe(false);
    expect(isValidThreadListFilter("string")).toBe(false);
    expect(isValidThreadListFilter({ archived: "true" })).toBe(false);
    expect(isValidThreadListFilter({ isBacklog: "false" })).toBe(false);
    expect(isValidThreadListFilter({ automationId: 123 })).toBe(false);
  });
});

describe("isMatchingThreadForFilter", () => {
  describe("archived filter", () => {
    it("should match when archived filter is undefined", () => {
      const thread = createMockThreadInfo({ archived: true });
      expect(isMatchingThreadForFilter(thread, {})).toBe(true);
    });

    it("should match when archived matches filter", () => {
      const archivedThread = createMockThreadInfo({ archived: true });
      const activeThread = createMockThreadInfo({ archived: false });

      expect(
        isMatchingThreadForFilter(archivedThread, { archived: true }),
      ).toBe(true);
      expect(isMatchingThreadForFilter(activeThread, { archived: false })).toBe(
        true,
      );
    });

    it("should not match when archived does not match filter", () => {
      const archivedThread = createMockThreadInfo({ archived: true });
      const activeThread = createMockThreadInfo({ archived: false });

      expect(
        isMatchingThreadForFilter(archivedThread, { archived: false }),
      ).toBe(false);
      expect(isMatchingThreadForFilter(activeThread, { archived: true })).toBe(
        false,
      );
    });
  });

  describe("isBacklog filter", () => {
    it("should match when isBacklog filter is undefined", () => {
      const thread = createMockThreadInfo({ isBacklog: true });
      expect(isMatchingThreadForFilter(thread, {})).toBe(true);
    });

    it("should match when isBacklog matches filter", () => {
      const backlogThread = createMockThreadInfo({ isBacklog: true });
      const inboxThread = createMockThreadInfo({ isBacklog: false });

      expect(
        isMatchingThreadForFilter(backlogThread, { isBacklog: true }),
      ).toBe(true);
      expect(isMatchingThreadForFilter(inboxThread, { isBacklog: false })).toBe(
        true,
      );
    });

    it("should not match when isBacklog does not match filter", () => {
      const backlogThread = createMockThreadInfo({ isBacklog: true });
      const inboxThread = createMockThreadInfo({ isBacklog: false });

      expect(
        isMatchingThreadForFilter(backlogThread, { isBacklog: false }),
      ).toBe(false);
      expect(isMatchingThreadForFilter(inboxThread, { isBacklog: true })).toBe(
        false,
      );
    });
  });

  describe("automationId filter", () => {
    it("should match when automationId filter is undefined", () => {
      const thread = createMockThreadInfo({ automationId: "test-automation" });
      expect(isMatchingThreadForFilter(thread, {})).toBe(true);
    });

    it("should match when automationId matches filter", () => {
      const thread = createMockThreadInfo({ automationId: "test-automation" });
      expect(
        isMatchingThreadForFilter(thread, { automationId: "test-automation" }),
      ).toBe(true);
    });

    it("should not match when automationId does not match filter", () => {
      const thread = createMockThreadInfo({ automationId: "test-automation" });
      expect(
        isMatchingThreadForFilter(thread, {
          automationId: "different-automation",
        }),
      ).toBe(false);
    });
  });

  describe("combined filters", () => {
    it("should match when all filters match", () => {
      const thread = createMockThreadInfo({
        archived: false,
        isBacklog: true,
        automationId: "test-automation",
      });
      const filters: ThreadListFilters = {
        archived: false,
        isBacklog: true,
        automationId: "test-automation",
      };
      expect(isMatchingThreadForFilter(thread, filters)).toBe(true);
    });

    it("should not match when any filter does not match", () => {
      const thread = createMockThreadInfo({
        archived: false,
        isBacklog: true,
        automationId: "test-automation",
      });

      // archived mismatch
      expect(
        isMatchingThreadForFilter(thread, {
          archived: true,
          isBacklog: true,
        }),
      ).toBe(false);

      // isBacklog mismatch
      expect(
        isMatchingThreadForFilter(thread, {
          archived: false,
          isBacklog: false,
        }),
      ).toBe(false);

      // automationId mismatch
      expect(
        isMatchingThreadForFilter(thread, {
          archived: false,
          automationId: "different",
        }),
      ).toBe(false);
    });
  });
});

describe("threadQueryOptions", () => {
  it("should return options with cache configuration for mobile performance", () => {
    const options = threadQueryOptions("test-thread-id");

    // Verify cache settings exist for mobile performance optimization
    // Increased from 30s/5m to 2m/10m for better mobile cache hit rates
    expect(options.staleTime).toBe(2 * 60 * 1000); // 2 minutes
    expect(options.gcTime).toBe(10 * 60 * 1000); // 10 minutes
  });

  it("should include correct query key for thread detail", () => {
    const threadId = "test-thread-123";
    const options = threadQueryOptions(threadId);

    expect(options.queryKey).toEqual(["threads", "detail", threadId]);
  });

  it("should include queryFn that can be called", () => {
    const options = threadQueryOptions("test-thread-id");

    expect(typeof options.queryFn).toBe("function");
  });
});
