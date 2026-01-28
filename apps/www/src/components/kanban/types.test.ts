import { describe, it, expect } from "vitest";
import { getKanbanColumn, KANBAN_COLUMNS } from "./types";
import { ThreadInfo, ThreadStatus } from "@terragon/shared";

// Helper to create a mock ThreadInfo with specific status and properties
function createMockThread(
  overrides: {
    status?: ThreadStatus;
    errorMessage?: string | null;
    githubPRNumber?: number | null;
    prStatus?: "draft" | "open" | "closed" | "merged" | null;
    prChecksStatus?:
      | "none"
      | "pending"
      | "success"
      | "failure"
      | "unknown"
      | null;
  } = {},
): ThreadInfo {
  return {
    id: "test-thread-id",
    userId: "test-user-id",
    name: "Test Thread",
    githubRepoFullName: "test/repo",
    repoBaseBranchName: "main",
    branchName: "feature/test",
    githubPRNumber: overrides.githubPRNumber ?? null,
    githubIssueNumber: null,
    codesandboxId: null,
    sandboxProvider: "e2b",
    sandboxSize: null,
    sandboxStatus: null,
    bootingSubstatus: null,
    gitDiffStats: null,
    archived: false,
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
    prChecksStatus: overrides.prChecksStatus ?? null,
    authorName: null,
    authorImage: null,
    threadChats: [
      {
        id: "test-chat-id",
        agent: "claudeCode",
        status: overrides.status ?? "queued",
        errorMessage: overrides.errorMessage ?? null,
      },
    ],
  } as ThreadInfo;
}

describe("Kanban Types", () => {
  describe("KANBAN_COLUMNS", () => {
    it("should have exactly 5 columns", () => {
      expect(KANBAN_COLUMNS).toHaveLength(5);
    });

    it("should have the correct column order", () => {
      const columnIds = KANBAN_COLUMNS.map((c) => c.id);
      expect(columnIds).toEqual([
        "backlog",
        "in_progress",
        "in_review",
        "done",
        "cancelled",
      ]);
    });

    it("should have titles for all columns", () => {
      KANBAN_COLUMNS.forEach((column) => {
        expect(column.title).toBeTruthy();
        expect(typeof column.title).toBe("string");
      });
    });

    it("should have descriptions for all columns", () => {
      KANBAN_COLUMNS.forEach((column) => {
        expect(column.description).toBeTruthy();
        expect(typeof column.description).toBe("string");
      });
    });
  });

  describe("getKanbanColumn", () => {
    describe("Backlog column", () => {
      it("should return backlog for draft status", () => {
        const thread = createMockThread({ status: "draft" });
        expect(getKanbanColumn(thread)).toBe("backlog");
      });

      it("should return backlog for scheduled status", () => {
        const thread = createMockThread({ status: "scheduled" });
        expect(getKanbanColumn(thread)).toBe("backlog");
      });

      it("should return backlog for queued status", () => {
        const thread = createMockThread({ status: "queued" });
        expect(getKanbanColumn(thread)).toBe("backlog");
      });

      it("should return backlog for queued-tasks-concurrency status", () => {
        const thread = createMockThread({
          status: "queued-tasks-concurrency",
        });
        expect(getKanbanColumn(thread)).toBe("backlog");
      });

      it("should return backlog for queued-sandbox-creation-rate-limit status", () => {
        const thread = createMockThread({
          status: "queued-sandbox-creation-rate-limit",
        });
        expect(getKanbanColumn(thread)).toBe("backlog");
      });

      it("should return backlog for queued-agent-rate-limit status", () => {
        const thread = createMockThread({
          status: "queued-agent-rate-limit",
        });
        expect(getKanbanColumn(thread)).toBe("backlog");
      });

      it("should return backlog for queued-blocked status", () => {
        const thread = createMockThread({ status: "queued-blocked" });
        expect(getKanbanColumn(thread)).toBe("backlog");
      });
    });

    describe("In Progress column", () => {
      it("should return in_progress for booting status", () => {
        const thread = createMockThread({ status: "booting" });
        expect(getKanbanColumn(thread)).toBe("in_progress");
      });

      it("should return in_progress for working status", () => {
        const thread = createMockThread({ status: "working" });
        expect(getKanbanColumn(thread)).toBe("in_progress");
      });

      it("should return in_progress for stopping status", () => {
        const thread = createMockThread({ status: "stopping" });
        expect(getKanbanColumn(thread)).toBe("in_progress");
      });

      it("should return in_progress for checkpointing status", () => {
        const thread = createMockThread({ status: "checkpointing" });
        expect(getKanbanColumn(thread)).toBe("in_progress");
      });

      it("should return in_progress for working-done status", () => {
        const thread = createMockThread({ status: "working-done" });
        expect(getKanbanColumn(thread)).toBe("in_progress");
      });
    });

    describe("In Review column", () => {
      it("should return in_review for complete status with open PR", () => {
        const thread = createMockThread({
          status: "complete",
          githubPRNumber: 123,
          prStatus: "open",
        });
        expect(getKanbanColumn(thread)).toBe("in_review");
      });

      it("should return in_review for complete status with failing PR checks", () => {
        const thread = createMockThread({
          status: "complete",
          githubPRNumber: 123,
          prStatus: "closed",
          prChecksStatus: "failure",
        });
        expect(getKanbanColumn(thread)).toBe("in_review");
      });
    });

    describe("Done column", () => {
      it("should return done for complete status without PR", () => {
        const thread = createMockThread({
          status: "complete",
          githubPRNumber: null,
          prStatus: null,
        });
        expect(getKanbanColumn(thread)).toBe("done");
      });

      it("should return done for complete status with merged PR", () => {
        const thread = createMockThread({
          status: "complete",
          githubPRNumber: 123,
          prStatus: "merged",
        });
        expect(getKanbanColumn(thread)).toBe("done");
      });

      it("should return done for complete status with closed PR and successful checks", () => {
        const thread = createMockThread({
          status: "complete",
          githubPRNumber: 123,
          prStatus: "closed",
          prChecksStatus: "success",
        });
        expect(getKanbanColumn(thread)).toBe("done");
      });
    });

    describe("Cancelled column", () => {
      it("should return cancelled for error status", () => {
        const thread = createMockThread({ status: "error" });
        expect(getKanbanColumn(thread)).toBe("cancelled");
      });

      it("should return cancelled for working-error status", () => {
        const thread = createMockThread({ status: "working-error" });
        expect(getKanbanColumn(thread)).toBe("cancelled");
      });

      it("should return cancelled for stopped status", () => {
        const thread = createMockThread({ status: "stopped" });
        expect(getKanbanColumn(thread)).toBe("cancelled");
      });

      it("should return cancelled for working-stopped status", () => {
        const thread = createMockThread({ status: "working-stopped" });
        expect(getKanbanColumn(thread)).toBe("cancelled");
      });
    });

    describe("Edge cases", () => {
      it("should handle thread with empty threadChats array", () => {
        const thread = createMockThread();
        thread.threadChats = [];
        // Empty threadChats defaults to "queued" which maps to backlog
        expect(getKanbanColumn(thread)).toBe("backlog");
      });

      it("should handle thread with multiple chats by priority", () => {
        const thread = createMockThread();
        thread.threadChats = [
          {
            id: "1",
            agent: "claudeCode",
            status: "complete",
            errorMessage: null,
          },
          {
            id: "2",
            agent: "claudeCode",
            status: "working",
            errorMessage: null,
          },
        ];
        // "working" has higher priority than "complete"
        expect(getKanbanColumn(thread)).toBe("in_progress");
      });

      it("should prioritize error states", () => {
        const thread = createMockThread();
        thread.threadChats = [
          {
            id: "1",
            agent: "claudeCode",
            status: "complete",
            errorMessage: null,
          },
          {
            id: "2",
            agent: "claudeCode",
            status: "working-error",
            errorMessage: "error",
          },
        ];
        // "working-error" should take precedence
        expect(getKanbanColumn(thread)).toBe("cancelled");
      });
    });
  });
});
