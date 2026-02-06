import { describe, it, vi, beforeEach, expect } from "vitest";
import { maybeEnableAutoMerge } from "./auto-merge";
import { db } from "@/lib/db";
import { createTestUser } from "@terragon/shared/model/test-helpers";
import { User } from "@terragon/shared";
import { createThread, updateThread } from "@terragon/shared/model/threads";
import { mockWaitUntil, waitUntilResolved } from "@/test-helpers/mock-next";

// Create mock functions at module level to avoid hoisting issues
const mockPullsGet = vi.fn();
const mockGraphql = vi.fn();

vi.mock("@/lib/github", () => ({
  getOctokitForUserOrThrow: vi.fn().mockImplementation(() =>
    Promise.resolve({
      rest: {
        pulls: {
          get: mockPullsGet,
        },
      },
      graphql: mockGraphql,
    }),
  ),
  parseRepoFullName: vi.fn((fullName: string) => fullName.split("/")),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogServer: vi.fn().mockReturnValue({
    capture: vi.fn(),
  }),
}));

const repoFullName = "terragon/test-repo";

describe("maybeEnableAutoMerge", () => {
  let user: User;
  let threadId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const testUserResult = await createTestUser({ db });
    user = testUserResult.user;
    await mockWaitUntil();

    // Create a test thread with auto-merge enabled
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
        autoFixFeedback: false,
        autoMergePR: true,
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

  it("should not enable auto-merge when setting is disabled", async () => {
    // Disable auto-merge for this thread
    await updateThread({
      db,
      userId: user.id,
      threadId,
      updates: { autoMergePR: false },
    });

    const result = await maybeEnableAutoMerge({
      threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("Auto-merge PR is not enabled");
  });

  it("should not enable auto-merge when thread has no PR", async () => {
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
        autoFixFeedback: false,
        autoMergePR: true,
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

    const result = await maybeEnableAutoMerge({
      threadId: resultWithoutPR.threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("Thread does not have an associated PR");
  });

  it("should not enable auto-merge when PR is already merged", async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        merged: true,
        state: "closed",
        auto_merge: null,
        node_id: "PR_123",
      },
    });

    const result = await maybeEnableAutoMerge({
      threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("PR is already merged");
  });

  it("should not enable auto-merge when PR is closed", async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        merged: false,
        state: "closed",
        auto_merge: null,
        node_id: "PR_123",
      },
    });

    const result = await maybeEnableAutoMerge({
      threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("PR is closed");
  });

  it("should return success when auto-merge is already enabled", async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        merged: false,
        state: "open",
        auto_merge: { merge_method: "squash" },
        node_id: "PR_123",
      },
    });

    const result = await maybeEnableAutoMerge({
      threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(true);
    expect(result.reason).toBe("Auto-merge is already enabled");
    expect(mockGraphql).not.toHaveBeenCalled();
  });

  it("should enable auto-merge via GraphQL when PR is open", async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        merged: false,
        state: "open",
        auto_merge: null,
        node_id: "PR_123",
      },
    });
    mockGraphql.mockResolvedValue({
      enablePullRequestAutoMerge: {
        pullRequest: {
          id: "PR_123",
          autoMergeRequest: {
            enabledAt: new Date().toISOString(),
            mergeMethod: "SQUASH",
          },
        },
      },
    });

    const result = await maybeEnableAutoMerge({
      threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(true);
    expect(result.reason).toBe("Auto-merge enabled successfully");
    expect(mockGraphql).toHaveBeenCalledWith(
      expect.stringContaining("enablePullRequestAutoMerge"),
      expect.objectContaining({
        pullRequestId: "PR_123",
        mergeMethod: "SQUASH",
      }),
    );
  });

  it("should handle PR not found error", async () => {
    const error: Error & { status?: number } = new Error("Not Found");
    error.status = 404;
    mockPullsGet.mockRejectedValue(error);

    const result = await maybeEnableAutoMerge({
      threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("PR #123 not found");
  });

  it("should handle auto-merge not allowed error", async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        merged: false,
        state: "open",
        auto_merge: null,
        node_id: "PR_123",
      },
    });
    mockGraphql.mockRejectedValue({
      errors: [{ message: "Auto-merge is not allowed for this repository" }],
    });

    const result = await maybeEnableAutoMerge({
      threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("Auto-merge is not allowed for this repository");
  });

  it("should handle protected branch error", async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        merged: false,
        state: "open",
        auto_merge: null,
        node_id: "PR_123",
      },
    });
    mockGraphql.mockRejectedValue({
      errors: [
        { message: "protected branch rules prevent enabling auto-merge" },
      ],
    });

    const result = await maybeEnableAutoMerge({
      threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe(
      "protected branch rules prevent enabling auto-merge",
    );
  });

  it("should handle unstable status error when PR has failing checks", async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        merged: false,
        state: "open",
        auto_merge: null,
        node_id: "PR_123",
      },
    });
    mockGraphql.mockRejectedValue({
      errors: [{ message: "Pull request is in unstable status" }],
    });

    const result = await maybeEnableAutoMerge({
      threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("Pull request is in unstable status");
  });

  it("should handle generic GraphQL errors", async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        merged: false,
        state: "open",
        auto_merge: null,
        node_id: "PR_123",
      },
    });
    mockGraphql.mockRejectedValue({
      errors: [{ message: "Something unexpected happened" }],
    });

    const result = await maybeEnableAutoMerge({
      threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("Something unexpected happened");
  });

  it("should handle generic errors", async () => {
    mockPullsGet.mockResolvedValue({
      data: {
        merged: false,
        state: "open",
        auto_merge: null,
        node_id: "PR_123",
      },
    });
    mockGraphql.mockRejectedValue(new Error("Network error"));

    const result = await maybeEnableAutoMerge({
      threadId,
      userId: user.id,
    });

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("Network error");
  });
});
