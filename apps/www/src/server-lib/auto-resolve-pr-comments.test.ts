import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before importing the module
vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/github", () => ({
  getOctokitForApp: vi.fn(),
  parseRepoFullName: vi.fn((fullName: string) => fullName.split("/")),
}));

vi.mock("@terragon/shared/github/pr-feedback", () => ({
  resolveThreadsCreatedBefore: vi.fn(),
}));

vi.mock("@terragon/shared/model/threads", () => ({
  getThreadMinimal: vi.fn(),
  updateThread: vi.fn(),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogServer: vi.fn(() => ({
    capture: vi.fn(),
  })),
}));

import { maybeAutoResolvePRComments } from "./auto-resolve-pr-comments";
import { getOctokitForApp } from "@/lib/github";
import { resolveThreadsCreatedBefore } from "@terragon/shared/github/pr-feedback";
import { getThreadMinimal, updateThread } from "@terragon/shared/model/threads";
import { getPostHogServer } from "@/lib/posthog-server";

describe("maybeAutoResolvePRComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null if thread not found", async () => {
    vi.mocked(getThreadMinimal).mockResolvedValue(null);

    const result = await maybeAutoResolvePRComments({
      userId: "user-123",
      threadId: "thread-123",
    });

    expect(result).toBeNull();
    expect(resolveThreadsCreatedBefore).not.toHaveBeenCalled();
  });

  it("should return null if auto-fix feedback is not enabled", async () => {
    vi.mocked(getThreadMinimal).mockResolvedValue({
      autoFixFeedback: false,
      githubPRNumber: 123,
      githubRepoFullName: "owner/repo",
      autoFixQueuedAt: new Date(),
    } as any);

    const result = await maybeAutoResolvePRComments({
      userId: "user-123",
      threadId: "thread-123",
    });

    expect(result).toBeNull();
    expect(resolveThreadsCreatedBefore).not.toHaveBeenCalled();
  });

  it("should return null if thread has no PR number", async () => {
    vi.mocked(getThreadMinimal).mockResolvedValue({
      autoFixFeedback: true,
      githubPRNumber: null,
      githubRepoFullName: "owner/repo",
      autoFixQueuedAt: new Date(),
    } as any);

    const result = await maybeAutoResolvePRComments({
      userId: "user-123",
      threadId: "thread-123",
    });

    expect(result).toBeNull();
    expect(resolveThreadsCreatedBefore).not.toHaveBeenCalled();
  });

  it("should return null if thread has no repo full name", async () => {
    vi.mocked(getThreadMinimal).mockResolvedValue({
      autoFixFeedback: true,
      githubPRNumber: 123,
      githubRepoFullName: null,
      autoFixQueuedAt: new Date(),
    } as any);

    const result = await maybeAutoResolvePRComments({
      userId: "user-123",
      threadId: "thread-123",
    });

    expect(result).toBeNull();
    expect(resolveThreadsCreatedBefore).not.toHaveBeenCalled();
  });

  it("should return null if autoFixQueuedAt is not set", async () => {
    vi.mocked(getThreadMinimal).mockResolvedValue({
      autoFixFeedback: true,
      githubPRNumber: 123,
      githubRepoFullName: "owner/repo",
      autoFixQueuedAt: null,
    } as any);

    const result = await maybeAutoResolvePRComments({
      userId: "user-123",
      threadId: "thread-123",
    });

    expect(result).toBeNull();
    expect(resolveThreadsCreatedBefore).not.toHaveBeenCalled();
  });

  it("should resolve threads and clear autoFixQueuedAt when all conditions are met", async () => {
    const queuedAt = new Date("2024-01-15T10:00:00Z");
    vi.mocked(getThreadMinimal).mockResolvedValue({
      autoFixFeedback: true,
      githubPRNumber: 123,
      githubRepoFullName: "owner/repo",
      autoFixQueuedAt: queuedAt,
    } as any);

    const mockOctokit = {} as any;
    vi.mocked(getOctokitForApp).mockResolvedValue(mockOctokit);
    vi.mocked(resolveThreadsCreatedBefore).mockResolvedValue({
      resolved: 2,
      failed: 0,
      skipped: 1,
    });
    vi.mocked(updateThread).mockResolvedValue({} as any);

    const mockCapture = vi.fn();
    vi.mocked(getPostHogServer).mockReturnValue({
      capture: mockCapture,
    } as any);

    const result = await maybeAutoResolvePRComments({
      userId: "user-123",
      threadId: "thread-123",
    });

    expect(result).toEqual({ resolved: 2, failed: 0, skipped: 1 });

    // Should have called resolveThreadsCreatedBefore with correct params
    expect(resolveThreadsCreatedBefore).toHaveBeenCalledWith(
      mockOctokit,
      "owner",
      "repo",
      123,
      queuedAt.toISOString(),
    );

    // Should have cleared autoFixQueuedAt
    expect(updateThread).toHaveBeenCalledWith({
      db: expect.anything(),
      userId: "user-123",
      threadId: "thread-123",
      updates: {
        autoFixQueuedAt: null,
      },
    });

    // Should have tracked the event
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: "user-123",
      event: "auto_resolve_pr_comments",
      properties: {
        threadId: "thread-123",
        prNumber: 123,
        resolved: 2,
        failed: 0,
        skipped: 1,
      },
    });
  });

  it("should not track event if no threads resolved or failed", async () => {
    const queuedAt = new Date("2024-01-15T10:00:00Z");
    vi.mocked(getThreadMinimal).mockResolvedValue({
      autoFixFeedback: true,
      githubPRNumber: 123,
      githubRepoFullName: "owner/repo",
      autoFixQueuedAt: queuedAt,
    } as any);

    vi.mocked(getOctokitForApp).mockResolvedValue({} as any);
    vi.mocked(resolveThreadsCreatedBefore).mockResolvedValue({
      resolved: 0,
      failed: 0,
      skipped: 3,
    });
    vi.mocked(updateThread).mockResolvedValue({} as any);

    const mockCapture = vi.fn();
    vi.mocked(getPostHogServer).mockReturnValue({
      capture: mockCapture,
    } as any);

    const result = await maybeAutoResolvePRComments({
      userId: "user-123",
      threadId: "thread-123",
    });

    expect(result).toEqual({ resolved: 0, failed: 0, skipped: 3 });

    // Should NOT have tracked the event since no threads were resolved/failed
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("should handle errors gracefully and return null", async () => {
    vi.mocked(getThreadMinimal).mockRejectedValue(new Error("Database error"));

    const result = await maybeAutoResolvePRComments({
      userId: "user-123",
      threadId: "thread-123",
    });

    expect(result).toBeNull();
  });
});
