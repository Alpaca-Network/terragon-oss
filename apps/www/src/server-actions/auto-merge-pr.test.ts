import { describe, expect, it, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createTestUser } from "@terragon/shared/model/test-helpers";
import { mockLoggedInUser } from "@/test-helpers/mock-next";
import { enableAutoMerge, disableAutoMerge } from "./auto-merge-pr";
import * as githubModule from "@/lib/github";

// Mock the GitHub module
vi.mock("@/lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof githubModule>();
  return {
    ...actual,
    getOctokitForUserOrThrow: vi.fn(),
  };
});

// Mock PostHog
vi.mock("@/lib/posthog-server", () => ({
  getPostHogServer: vi.fn(() => ({ capture: vi.fn() })),
}));

describe("enableAutoMerge", () => {
  const mockOctokit = {
    rest: {
      pulls: {
        get: vi.fn(),
      },
    },
    graphql: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(githubModule.getOctokitForUserOrThrow).mockResolvedValue(
      mockOctokit as any,
    );
  });

  it("should enable auto-merge on a PR", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const prDetails = {
      node_id: "PR_123",
      merged: false,
      state: "open",
      auto_merge: null,
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.graphql.mockResolvedValue({
      enablePullRequestAutoMerge: {
        pullRequest: {
          id: "PR_123",
          autoMergeRequest: {
            enabledAt: "2024-01-01T00:00:00Z",
            mergeMethod: "SQUASH",
          },
        },
      },
    });

    const result = await enableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
      mergeMethod: "squash",
    });

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(true);
    expect(result.data?.message).toBe("Auto-merge enabled successfully");
    expect(mockOctokit.graphql).toHaveBeenCalledWith(
      expect.stringContaining("enablePullRequestAutoMerge"),
      expect.objectContaining({
        pullRequestId: "PR_123",
        mergeMethod: "SQUASH",
      }),
    );
  });

  it("should return success if auto-merge is already enabled", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const prDetails = {
      node_id: "PR_123",
      merged: false,
      state: "open",
      auto_merge: {
        enabled_by: { login: "user" },
        merge_method: "squash",
      },
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });

    const result = await enableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
    });

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(true);
    expect(result.data?.message).toBe("Auto-merge is already enabled");
    expect(mockOctokit.graphql).not.toHaveBeenCalled();
  });

  it("should return error if PR is already merged", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const prDetails = {
      node_id: "PR_123",
      merged: true,
      state: "closed",
      auto_merge: null,
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });

    const result = await enableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
    });

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(false);
    expect(result.data?.message).toBe("PR is already merged");
  });

  it("should return error if PR is closed", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const prDetails = {
      node_id: "PR_123",
      merged: false,
      state: "closed",
      auto_merge: null,
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });

    const result = await enableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain(
      "Cannot enable auto-merge on a closed PR",
    );
  });

  it("should use correct merge method mapping", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const prDetails = {
      node_id: "PR_123",
      merged: false,
      state: "open",
      auto_merge: null,
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.graphql.mockResolvedValue({
      enablePullRequestAutoMerge: {
        pullRequest: { id: "PR_123", autoMergeRequest: null },
      },
    });

    // Test merge method
    await enableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
      mergeMethod: "merge",
    });

    expect(mockOctokit.graphql).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ mergeMethod: "MERGE" }),
    );

    vi.clearAllMocks();
    vi.mocked(githubModule.getOctokitForUserOrThrow).mockResolvedValue(
      mockOctokit as any,
    );
    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.graphql.mockResolvedValue({
      enablePullRequestAutoMerge: {
        pullRequest: { id: "PR_123", autoMergeRequest: null },
      },
    });

    // Test rebase method
    await enableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
      mergeMethod: "rebase",
    });

    expect(mockOctokit.graphql).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ mergeMethod: "REBASE" }),
    );
  });

  it("should handle GraphQL auto-merge not allowed errors", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const prDetails = {
      node_id: "PR_123",
      merged: false,
      state: "open",
      auto_merge: null,
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.graphql.mockRejectedValue({
      errors: [{ message: "Auto-merge is not allowed for this repository" }],
    });

    const result = await enableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain(
      "Auto-merge is not enabled for this repository",
    );
  });

  it("should handle authorization errors", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const prDetails = {
      node_id: "PR_123",
      merged: false,
      state: "open",
      auto_merge: null,
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.graphql.mockRejectedValue({
      errors: [{ message: "User is not authorized for this protected branch" }],
    });

    const result = await enableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain(
      "You are not authorized to enable auto-merge on this PR",
    );
  });

  it("should handle unstable status error when PR has failing checks", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const prDetails = {
      node_id: "PR_123",
      merged: false,
      state: "open",
      auto_merge: null,
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.graphql.mockRejectedValue({
      errors: [{ message: "Pull request is in unstable status" }],
    });

    const result = await enableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain(
      "Cannot enable auto-merge: PR has failing checks",
    );
  });
});

describe("disableAutoMerge", () => {
  const mockOctokit = {
    rest: {
      pulls: {
        get: vi.fn(),
      },
    },
    graphql: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(githubModule.getOctokitForUserOrThrow).mockResolvedValue(
      mockOctokit as any,
    );
  });

  it("should disable auto-merge on a PR", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const prDetails = {
      node_id: "PR_123",
      merged: false,
      auto_merge: {
        enabled_by: { login: "user" },
        merge_method: "squash",
      },
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.graphql.mockResolvedValue({
      disablePullRequestAutoMerge: {
        pullRequest: {
          id: "PR_123",
          autoMergeRequest: null,
        },
      },
    });

    const result = await disableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
    });

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(true);
    expect(result.data?.message).toBe("Auto-merge disabled successfully");
    expect(mockOctokit.graphql).toHaveBeenCalledWith(
      expect.stringContaining("disablePullRequestAutoMerge"),
      expect.objectContaining({
        pullRequestId: "PR_123",
      }),
    );
  });

  it("should return success if auto-merge is not enabled", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const prDetails = {
      node_id: "PR_123",
      merged: false,
      auto_merge: null,
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });

    const result = await disableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
    });

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(true);
    expect(result.data?.message).toBe("Auto-merge is not enabled");
    expect(mockOctokit.graphql).not.toHaveBeenCalled();
  });

  it("should return error if PR is already merged", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const prDetails = {
      node_id: "PR_123",
      merged: true,
      auto_merge: {
        enabled_by: { login: "user" },
        merge_method: "squash",
      },
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });

    const result = await disableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
    });

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(false);
    expect(result.data?.message).toBe("PR is already merged");
  });

  it("should handle 404 errors", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    mockOctokit.rest.pulls.get.mockRejectedValue({ status: 404 });

    const result = await disableAutoMerge({
      repoFullName: "owner/repo",
      prNumber: 123,
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("PR #123 not found in owner/repo");
  });
});
