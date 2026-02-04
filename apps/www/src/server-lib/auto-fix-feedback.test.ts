import { describe, it, vi, beforeEach, expect, Mock } from "vitest";
import {
  maybeQueueAutoFixFollowUp,
  resetAutoFixIterationCount,
} from "./auto-fix-feedback";
import { db } from "@/lib/db";
import { createTestUser } from "@terragon/shared/model/test-helpers";
import { User, DBUserMessage } from "@terragon/shared";
import {
  createThread,
  getThread,
  updateThread,
  updateThreadChat,
  updateThreadChatStatusAtomic,
} from "@terragon/shared/model/threads";
import { mockWaitUntil, waitUntilResolved } from "@/test-helpers/mock-next";
import {
  aggregatePRFeedback,
  createFeedbackSummary,
} from "@terragon/shared/github/pr-feedback";

// Mock external dependencies
vi.mock("@/lib/github", () => ({
  getOctokitForApp: vi.fn().mockResolvedValue({}),
  parseRepoFullName: vi.fn((fullName: string) => fullName.split("/")),
}));

vi.mock("@terragon/shared/github/pr-feedback", () => ({
  aggregatePRFeedback: vi.fn(),
  createFeedbackSummary: vi.fn(),
}));

vi.mock("./follow-up", () => ({
  queueFollowUpInternal: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogServer: vi.fn().mockReturnValue({
    capture: vi.fn(),
  }),
}));

const repoFullName = "terragon/test-repo";
const mockMessage: DBUserMessage = {
  type: "user",
  parts: [{ type: "text", text: "Test task message" }],
  model: "sonnet",
};

describe("maybeQueueAutoFixFollowUp", () => {
  let user: User;
  let threadId: string;
  let threadChatId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const testUserResult = await createTestUser({ db });
    user = testUserResult.user;
    await mockWaitUntil();

    // Create a test thread with auto-fix enabled
    const result = await createThread({
      db,
      userId: user.id,
      threadValues: {
        githubRepoFullName: repoFullName,
        repoBaseBranchName: "main",
        branchName: "feature/test",
        name: "Test thread",
        sandboxProvider: "e2b",
        sandboxSize: null,
        parentThreadId: null,
        parentToolId: null,
        automationId: null,
        githubPRNumber: 123,
        githubIssueNumber: null,
        disableGitCheckpointing: false,
        skipSetup: false,
        autoFixFeedback: true,
        autoMergePR: false,
        sourceType: "www",
        sourceMetadata: null,
      },
      initialChatValues: {
        agent: "claudeCode",
        permissionMode: "allowAll",
        status: "complete",
        lastUsedModel: "sonnet",
      },
      enableThreadChatCreation: true,
    });
    threadId = result.threadId;
    threadChatId = result.threadChatId;
    await waitUntilResolved();
  });

  it("should not queue follow-up when auto-fix is disabled", async () => {
    // Disable auto-fix for this thread
    await updateThread({
      db,
      userId: user.id,
      threadId,
      updates: { autoFixFeedback: false },
    });

    const result = await maybeQueueAutoFixFollowUp({
      threadId,
      userId: user.id,
      triggerSource: "pr_comment",
    });

    expect(result.queued).toBe(false);
    expect(result.reason).toBe("Auto-fix feedback is not enabled");
  });

  it("should not queue follow-up when thread has no PR", async () => {
    // Create thread without PR number
    const resultWithoutPR = await createThread({
      db,
      userId: user.id,
      threadValues: {
        githubRepoFullName: repoFullName,
        repoBaseBranchName: "main",
        branchName: null,
        name: "Test thread without PR",
        sandboxProvider: "e2b",
        sandboxSize: null,
        parentThreadId: null,
        parentToolId: null,
        automationId: null,
        githubPRNumber: null, // No PR
        githubIssueNumber: null,
        disableGitCheckpointing: false,
        skipSetup: false,
        autoFixFeedback: true,
        autoMergePR: false,
        sourceType: "www",
        sourceMetadata: null,
      },
      initialChatValues: {
        agent: "claudeCode",
        permissionMode: "allowAll",
        status: "complete",
        lastUsedModel: "sonnet",
      },
      enableThreadChatCreation: true,
    });
    await waitUntilResolved();

    const result = await maybeQueueAutoFixFollowUp({
      threadId: resultWithoutPR.threadId,
      userId: user.id,
      triggerSource: "pr_comment",
    });

    expect(result.queued).toBe(false);
    expect(result.reason).toBe("Thread does not have an associated PR");
  });

  it("should not queue follow-up when max iterations reached", async () => {
    // Set iteration count to max
    await updateThread({
      db,
      userId: user.id,
      threadId,
      updates: { autoFixIterationCount: 5 },
    });

    const result = await maybeQueueAutoFixFollowUp({
      threadId,
      userId: user.id,
      triggerSource: "pr_comment",
    });

    expect(result.queued).toBe(false);
    expect(result.reason).toBe("Max auto-fix iterations (5) reached");
  });

  it("should not queue follow-up when agent is currently working", async () => {
    const workingStatuses = [
      "queued",
      "booting",
      "working",
      "checkpointing",
    ] as const;

    let previousStatus: (typeof workingStatuses)[number] | "complete" =
      "complete";
    for (const status of workingStatuses) {
      await updateThreadChatStatusAtomic({
        db,
        userId: user.id,
        threadId,
        threadChatId,
        fromStatus: previousStatus,
        toStatus: status,
      });
      previousStatus = status;

      const result = await maybeQueueAutoFixFollowUp({
        threadId,
        userId: user.id,
        triggerSource: "pr_comment",
      });

      expect(result.queued).toBe(false);
      expect(result.reason).toBe(
        "Agent is currently working, will check again when done",
      );
    }
  });

  it("should not queue follow-up when no actionable feedback", async () => {
    (aggregatePRFeedback as Mock).mockResolvedValue({});
    (createFeedbackSummary as Mock).mockReturnValue({
      unresolvedCommentCount: 0,
      failingCheckCount: 0,
    });

    const result = await maybeQueueAutoFixFollowUp({
      threadId,
      userId: user.id,
      triggerSource: "pr_comment",
    });

    expect(result.queued).toBe(false);
    expect(result.reason).toBe("No actionable feedback to address");
  });

  it("should queue follow-up when there are unresolved comments", async () => {
    (aggregatePRFeedback as Mock).mockResolvedValue({});
    (createFeedbackSummary as Mock).mockReturnValue({
      unresolvedCommentCount: 3,
      failingCheckCount: 0,
    });

    const result = await maybeQueueAutoFixFollowUp({
      threadId,
      userId: user.id,
      triggerSource: "pr_comment",
    });

    expect(result.queued).toBe(true);
    expect(result.reason).toContain("3 unresolved PR comments");

    // Verify iteration count was incremented
    const updatedThread = await getThread({ db, userId: user.id, threadId });
    expect(updatedThread!.autoFixIterationCount).toBe(1);
  });

  it("should queue follow-up when there are failing checks", async () => {
    (aggregatePRFeedback as Mock).mockResolvedValue({});
    (createFeedbackSummary as Mock).mockReturnValue({
      unresolvedCommentCount: 0,
      failingCheckCount: 2,
    });

    const result = await maybeQueueAutoFixFollowUp({
      threadId,
      userId: user.id,
      triggerSource: "check_run",
    });

    expect(result.queued).toBe(true);
    expect(result.reason).toContain("2 failing checks");

    // Verify iteration count was incremented
    const updatedThread = await getThread({ db, userId: user.id, threadId });
    expect(updatedThread!.autoFixIterationCount).toBe(1);
  });

  it("should queue follow-up with combined feedback message", async () => {
    (aggregatePRFeedback as Mock).mockResolvedValue({});
    (createFeedbackSummary as Mock).mockReturnValue({
      unresolvedCommentCount: 2,
      failingCheckCount: 1,
    });

    const result = await maybeQueueAutoFixFollowUp({
      threadId,
      userId: user.id,
      triggerSource: "review",
    });

    expect(result.queued).toBe(true);
    expect(result.reason).toContain("2 unresolved PR comments");
    expect(result.reason).toContain("1 failing check");
  });

  it("should not queue follow-up when there is already a queued message", async () => {
    // Add a queued message
    await updateThreadChat({
      db,
      userId: user.id,
      threadId,
      threadChatId,
      updates: {
        appendMessages: [mockMessage],
        replaceQueuedMessages: [mockMessage],
      },
    });

    const result = await maybeQueueAutoFixFollowUp({
      threadId,
      userId: user.id,
      triggerSource: "pr_comment",
    });

    expect(result.queued).toBe(false);
    expect(result.reason).toBe("Follow-up already queued");
  });
});

describe("resetAutoFixIterationCount", () => {
  let user: User;
  let threadId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const testUserResult = await createTestUser({ db });
    user = testUserResult.user;
    await mockWaitUntil();

    // Create a test thread
    const result = await createThread({
      db,
      userId: user.id,
      threadValues: {
        githubRepoFullName: repoFullName,
        repoBaseBranchName: "main",
        branchName: null,
        name: "Test thread",
        sandboxProvider: "e2b",
        sandboxSize: null,
        parentThreadId: null,
        parentToolId: null,
        automationId: null,
        githubPRNumber: 123,
        githubIssueNumber: null,
        disableGitCheckpointing: false,
        skipSetup: false,
        autoFixFeedback: true,
        autoMergePR: false,
        sourceType: "www",
        sourceMetadata: null,
      },
      initialChatValues: {
        agent: "claudeCode",
        permissionMode: "allowAll",
        status: "complete",
        lastUsedModel: "sonnet",
      },
      enableThreadChatCreation: true,
    });
    threadId = result.threadId;
    await waitUntilResolved();
  });

  it("should reset iteration count to zero", async () => {
    // Set a non-zero iteration count
    await updateThread({
      db,
      userId: user.id,
      threadId,
      updates: { autoFixIterationCount: 3 },
    });

    // Verify it was set
    let thread = await getThread({ db, userId: user.id, threadId });
    expect(thread!.autoFixIterationCount).toBe(3);

    // Reset the count
    await resetAutoFixIterationCount({
      threadId,
      userId: user.id,
    });

    // Verify it's now zero
    thread = await getThread({ db, userId: user.id, threadId });
    expect(thread!.autoFixIterationCount).toBe(0);
  });
});
