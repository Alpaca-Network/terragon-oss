import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  extractCoverageCheck,
  createFeedbackSummary,
  aggregatePRFeedback,
  fetchPRComments,
  fetchPRReviews,
  fetchPRDetails,
  fetchPRChecks,
  fetchReviewThreadsResolutionStatus,
} from "./pr-feedback";
import type { PRCheckRun, PRFeedback, PRReviewThread } from "../db/types";

describe("extractCoverageCheck", () => {
  const createCheck = (
    name: string,
    conclusion: PRCheckRun["conclusion"] = "success",
  ): PRCheckRun => ({
    id: Math.floor(Math.random() * 1000),
    name,
    status: "completed",
    conclusion,
    startedAt: "2024-01-01T00:00:00Z",
    completedAt: "2024-01-01T00:01:00Z",
    detailsUrl: "https://example.com",
    output: undefined,
  });

  it("should find codecov check", () => {
    const checks = [createCheck("Build"), createCheck("Codecov/patch")];
    const result = extractCoverageCheck(checks);
    expect(result?.name).toBe("Codecov/patch");
  });

  it("should find coverage check (case-insensitive)", () => {
    const checks = [createCheck("lint"), createCheck("Code Coverage Report")];
    const result = extractCoverageCheck(checks);
    expect(result?.name).toBe("Code Coverage Report");
  });

  it("should find coveralls check", () => {
    const checks = [createCheck("ci"), createCheck("coveralls")];
    const result = extractCoverageCheck(checks);
    expect(result?.name).toBe("coveralls");
  });

  it("should find jest coverage check", () => {
    const checks = [createCheck("build"), createCheck("jest/coverage")];
    const result = extractCoverageCheck(checks);
    expect(result?.name).toBe("jest/coverage");
  });

  it("should find nyc check", () => {
    const checks = [createCheck("test"), createCheck("nyc report")];
    const result = extractCoverageCheck(checks);
    expect(result?.name).toBe("nyc report");
  });

  it("should find istanbul check", () => {
    const checks = [createCheck("lint"), createCheck("istanbul coverage")];
    const result = extractCoverageCheck(checks);
    expect(result?.name).toBe("istanbul coverage");
  });

  it("should return null when no coverage check found", () => {
    const checks = [
      createCheck("Build"),
      createCheck("Lint"),
      createCheck("Test"),
    ];
    const result = extractCoverageCheck(checks);
    expect(result).toBeNull();
  });

  it("should return null for empty array", () => {
    const result = extractCoverageCheck([]);
    expect(result).toBeNull();
  });

  it("should return first matching coverage check when multiple exist", () => {
    const checks = [createCheck("Codecov/patch"), createCheck("Coveralls")];
    const result = extractCoverageCheck(checks);
    expect(result?.name).toBe("Codecov/patch");
  });
});

describe("createFeedbackSummary", () => {
  const createBaseFeedback = (
    overrides: Partial<PRFeedback> = {},
  ): PRFeedback => ({
    prNumber: 123,
    repoFullName: "owner/repo",
    prUrl: "https://github.com/owner/repo/pull/123",
    prTitle: "Test PR",
    prState: "open",
    baseBranch: "main",
    headBranch: "feature",
    headSha: "abc123",
    comments: { unresolved: [], resolved: [], inProgress: [] },
    checks: [],
    coverageCheck: null,
    mergeableState: "clean",
    hasConflicts: false,
    isMergeable: true,
    isAutoMergeEnabled: false,
    ...overrides,
  });

  const createThread = (
    commentCount: number,
    isResolved = false,
    isInProgress = false,
  ): PRReviewThread => ({
    id: String(Math.floor(Math.random() * 1000)),
    isResolved,
    isInProgress,
    comments: Array.from({ length: commentCount }, (_, i) => ({
      id: i,
      body: `Comment ${i}`,
      path: "file.ts",
      line: i + 1,
      originalLine: i + 1,
      side: "RIGHT" as const,
      author: { login: "user", avatarUrl: "https://example.com/avatar" },
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      htmlUrl: "https://github.com/owner/repo/pull/123#comment-1",
    })),
  });

  const createCheck = (
    status: PRCheckRun["status"],
    conclusion: PRCheckRun["conclusion"],
  ): PRCheckRun => ({
    id: Math.floor(Math.random() * 1000),
    name: "Test Check",
    status,
    conclusion,
    startedAt: "2024-01-01T00:00:00Z",
    completedAt: "2024-01-01T00:01:00Z",
    detailsUrl: "https://example.com",
  });

  it("should count unresolved comments correctly", () => {
    const feedback = createBaseFeedback({
      comments: {
        unresolved: [createThread(2), createThread(3)],
        resolved: [],
        inProgress: [],
      },
    });
    const summary = createFeedbackSummary(feedback);
    expect(summary.unresolvedCommentCount).toBe(5);
  });

  it("should count resolved comments correctly", () => {
    const feedback = createBaseFeedback({
      comments: {
        unresolved: [],
        resolved: [createThread(1, true), createThread(2, true)],
        inProgress: [],
      },
    });
    const summary = createFeedbackSummary(feedback);
    expect(summary.resolvedCommentCount).toBe(3);
  });

  it("should count failing checks correctly", () => {
    const feedback = createBaseFeedback({
      checks: [
        createCheck("completed", "success"),
        createCheck("completed", "failure"),
        createCheck("completed", "timed_out"),
        createCheck("completed", "cancelled"),
      ],
    });
    const summary = createFeedbackSummary(feedback);
    expect(summary.failingCheckCount).toBe(3);
  });

  it("should count pending checks correctly", () => {
    const feedback = createBaseFeedback({
      checks: [
        createCheck("queued", null),
        createCheck("in_progress", null),
        createCheck("completed", "success"),
      ],
    });
    const summary = createFeedbackSummary(feedback);
    expect(summary.pendingCheckCount).toBe(2);
  });

  it("should count passing checks correctly", () => {
    const feedback = createBaseFeedback({
      checks: [
        createCheck("completed", "success"),
        createCheck("completed", "neutral"),
        createCheck("completed", "skipped"),
        createCheck("completed", "failure"),
      ],
    });
    const summary = createFeedbackSummary(feedback);
    expect(summary.passingCheckCount).toBe(3);
  });

  it("should detect coverage check presence", () => {
    const coverageCheck = createCheck("completed", "success");
    coverageCheck.name = "Codecov";

    const feedbackWithCoverage = createBaseFeedback({
      coverageCheck,
    });
    const summaryWithCoverage = createFeedbackSummary(feedbackWithCoverage);
    expect(summaryWithCoverage.hasCoverageCheck).toBe(true);
    expect(summaryWithCoverage.coverageCheckPassed).toBe(true);

    const feedbackWithoutCoverage = createBaseFeedback({
      coverageCheck: null,
    });
    const summaryWithoutCoverage = createFeedbackSummary(
      feedbackWithoutCoverage,
    );
    expect(summaryWithoutCoverage.hasCoverageCheck).toBe(false);
    expect(summaryWithoutCoverage.coverageCheckPassed).toBeNull();
  });

  it("should handle failing coverage check", () => {
    const coverageCheck = createCheck("completed", "failure");
    coverageCheck.name = "Codecov";

    const feedback = createBaseFeedback({
      coverageCheck,
    });
    const summary = createFeedbackSummary(feedback);
    expect(summary.hasCoverageCheck).toBe(true);
    expect(summary.coverageCheckPassed).toBe(false);
  });

  it("should report conflicts status", () => {
    const feedbackWithConflicts = createBaseFeedback({
      hasConflicts: true,
      isMergeable: false,
    });
    const summaryWithConflicts = createFeedbackSummary(feedbackWithConflicts);
    expect(summaryWithConflicts.hasConflicts).toBe(true);
    expect(summaryWithConflicts.isMergeable).toBe(false);

    const feedbackWithoutConflicts = createBaseFeedback({
      hasConflicts: false,
      isMergeable: true,
    });
    const summaryWithoutConflicts = createFeedbackSummary(
      feedbackWithoutConflicts,
    );
    expect(summaryWithoutConflicts.hasConflicts).toBe(false);
    expect(summaryWithoutConflicts.isMergeable).toBe(true);
  });

  it("should return all zeros for empty feedback", () => {
    const feedback = createBaseFeedback();
    const summary = createFeedbackSummary(feedback);
    expect(summary.unresolvedCommentCount).toBe(0);
    expect(summary.resolvedCommentCount).toBe(0);
    expect(summary.failingCheckCount).toBe(0);
    expect(summary.pendingCheckCount).toBe(0);
    expect(summary.passingCheckCount).toBe(0);
  });
});

describe("fetchReviewThreadsResolutionStatus", () => {
  const mockOctokit = {
    graphql: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch and map resolution status from GraphQL", async () => {
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                id: "thread1",
                isResolved: true,
                isOutdated: false,
                comments: { nodes: [{ databaseId: 100 }] },
              },
              {
                id: "thread2",
                isResolved: false,
                isOutdated: true,
                comments: { nodes: [{ databaseId: 200 }] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });

    const result = await fetchReviewThreadsResolutionStatus(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    expect(result.get(100)).toEqual({ isResolved: true, isOutdated: false });
    expect(result.get(200)).toEqual({ isResolved: false, isOutdated: true });
  });

  it("should handle pagination", async () => {
    mockOctokit.graphql
      .mockResolvedValueOnce({
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [
                {
                  id: "thread1",
                  isResolved: true,
                  isOutdated: false,
                  comments: { nodes: [{ databaseId: 100 }] },
                },
              ],
              pageInfo: { hasNextPage: true, endCursor: "cursor1" },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [
                {
                  id: "thread2",
                  isResolved: false,
                  isOutdated: false,
                  comments: { nodes: [{ databaseId: 200 }] },
                },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      });

    const result = await fetchReviewThreadsResolutionStatus(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    expect(result.size).toBe(2);
    expect(result.get(100)).toEqual({ isResolved: true, isOutdated: false });
    expect(result.get(200)).toEqual({ isResolved: false, isOutdated: false });
  });

  it("should return empty map on GraphQL error", async () => {
    mockOctokit.graphql.mockRejectedValue(new Error("GraphQL error"));

    const result = await fetchReviewThreadsResolutionStatus(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    expect(result.size).toBe(0);
  });
});

describe("aggregatePRFeedback", () => {
  const mockOctokit = {
    rest: {
      pulls: {
        get: vi.fn(),
        listReviewComments: vi.fn(),
        listReviews: vi.fn(),
      },
      checks: {
        listForRef: vi.fn(),
      },
    },
    graphql: vi.fn(),
  };

  // Helper to create PR details with sensible defaults
  const createPRDetails = (
    overrides: Partial<{
      mergeable: boolean | null;
      mergeable_state: string;
      draft: boolean;
      closed_at: string | null;
      merged_at: string | null;
    }> = {},
  ) => ({
    html_url: "https://github.com/owner/repo/pull/123",
    title: "Test PR",
    draft: false,
    closed_at: null,
    merged_at: null,
    base: { ref: "main" },
    head: { ref: "feature", sha: "abc123" },
    mergeable: true,
    mergeable_state: "clean",
    ...overrides,
  });

  // Helper to setup minimal mocks for aggregatePRFeedback tests
  const setupMinimalMocks = (prDetails: ReturnType<typeof createPRDetails>) => {
    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });
    mockOctokit.rest.checks.listForRef.mockResolvedValue({
      data: { check_runs: [] },
    });
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should aggregate all PR feedback data", async () => {
    const prDetails = {
      html_url: "https://github.com/owner/repo/pull/123",
      title: "Test PR",
      draft: false,
      closed_at: null,
      merged_at: null,
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123" },
      mergeable: true,
      mergeable_state: "clean",
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          body: "Test comment",
          path: "file.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: { login: "reviewer", avatar_url: "https://example.com/avatar" },
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          in_reply_to_id: null,
          html_url: "https://github.com/owner/repo/pull/123#comment-1",
        },
      ],
    });
    mockOctokit.rest.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            id: 1,
            name: "Build",
            status: "completed",
            conclusion: "success",
            started_at: "2024-01-01T00:00:00Z",
            completed_at: "2024-01-01T00:01:00Z",
            details_url: "https://example.com",
            output: { title: "Build passed", summary: "All good" },
          },
        ],
      },
    });
    // Mock GraphQL for resolution status - comment not resolved
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                id: "thread1",
                isResolved: false,
                isOutdated: false,
                comments: { nodes: [{ databaseId: 1 }] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    expect(feedback.prNumber).toBe(123);
    expect(feedback.repoFullName).toBe("owner/repo");
    expect(feedback.prTitle).toBe("Test PR");
    expect(feedback.prState).toBe("open");
    expect(feedback.baseBranch).toBe("main");
    expect(feedback.headBranch).toBe("feature");
    expect(feedback.headSha).toBe("abc123");
    expect(feedback.comments.unresolved.length).toBe(1);
    expect(feedback.checks.length).toBe(1);
    expect(feedback.isMergeable).toBe(true);
    expect(feedback.hasConflicts).toBe(false);
  });

  it("should detect merge conflicts", async () => {
    const prDetails = createPRDetails({
      mergeable: false,
      mergeable_state: "dirty",
    });
    setupMinimalMocks(prDetails);

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    expect(feedback.hasConflicts).toBe(true);
    expect(feedback.isMergeable).toBe(false);
    expect(feedback.mergeableState).toBe("dirty");
  });

  it("should use GraphQL resolution status when available", async () => {
    const prDetails = {
      html_url: "https://github.com/owner/repo/pull/123",
      title: "Test PR",
      draft: false,
      closed_at: null,
      merged_at: null,
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123" },
      mergeable: true,
      mergeable_state: "clean",
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          body: "Initial comment",
          path: "file.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: { login: "reviewer", avatar_url: "https://example.com" },
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          in_reply_to_id: null,
          html_url: "https://github.com",
        },
        {
          id: 2,
          body: "I will work on this", // No resolution keyword
          path: "file.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: { login: "author", avatar_url: "https://example.com" },
          created_at: "2024-01-01T00:01:00Z",
          updated_at: "2024-01-01T00:01:00Z",
          in_reply_to_id: 1,
          html_url: "https://github.com",
        },
      ],
    });
    mockOctokit.rest.checks.listForRef.mockResolvedValue({
      data: { check_runs: [] },
    });
    // GraphQL says thread is resolved even though comment doesn't have keywords
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                id: "thread1",
                isResolved: true,
                isOutdated: false,
                comments: { nodes: [{ databaseId: 1 }] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    // Thread should be marked as resolved based on GraphQL API, not heuristics
    expect(feedback.comments.resolved.length).toBe(1);
    expect(feedback.comments.resolved[0]!.comments.length).toBe(2);
    expect(feedback.comments.unresolved.length).toBe(0);
  });

  it("should treat outdated comments as resolved", async () => {
    const prDetails = {
      html_url: "https://github.com/owner/repo/pull/123",
      title: "Test PR",
      draft: false,
      closed_at: null,
      merged_at: null,
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123" },
      mergeable: true,
      mergeable_state: "clean",
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          body: "This code needs refactoring",
          path: "file.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: { login: "reviewer", avatar_url: "https://example.com" },
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          in_reply_to_id: null,
          html_url: "https://github.com",
        },
      ],
    });
    mockOctokit.rest.checks.listForRef.mockResolvedValue({
      data: { check_runs: [] },
    });
    // GraphQL says thread is outdated (code has changed) but not explicitly resolved
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                id: "thread1",
                isResolved: false,
                isOutdated: true,
                comments: { nodes: [{ databaseId: 1 }] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    // Thread should be treated as resolved because it's outdated (code has changed)
    expect(feedback.comments.resolved.length).toBe(1);
    expect(feedback.comments.unresolved.length).toBe(0);
  });

  it("should fall back to heuristics when GraphQL fails", async () => {
    const prDetails = {
      html_url: "https://github.com/owner/repo/pull/123",
      title: "Test PR",
      draft: false,
      closed_at: null,
      merged_at: null,
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123" },
      mergeable: true,
      mergeable_state: "clean",
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          body: "Initial comment",
          path: "file.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: { login: "reviewer", avatar_url: "https://example.com" },
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          in_reply_to_id: null,
          html_url: "https://github.com",
        },
        {
          id: 2,
          body: "Done",
          path: "file.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: { login: "author", avatar_url: "https://example.com" },
          created_at: "2024-01-01T00:01:00Z",
          updated_at: "2024-01-01T00:01:00Z",
          in_reply_to_id: 1,
          html_url: "https://github.com",
        },
      ],
    });
    mockOctokit.rest.checks.listForRef.mockResolvedValue({
      data: { check_runs: [] },
    });
    // GraphQL fails
    mockOctokit.graphql.mockRejectedValue(new Error("GraphQL error"));

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    // Thread should be marked as resolved based on keyword heuristic (fallback)
    expect(feedback.comments.resolved.length).toBe(1);
    expect(feedback.comments.resolved[0]!.comments.length).toBe(2);
    expect(feedback.comments.unresolved.length).toBe(0);
  });

  it("should detect bot 'Addressed' markers in comment bodies", async () => {
    const prDetails = {
      html_url: "https://github.com/owner/repo/pull/123",
      title: "Test PR",
      draft: false,
      closed_at: null,
      merged_at: null,
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123" },
      mergeable: true,
      mergeable_state: "clean",
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          // CodeRabbit-style comment with "✅ Addressed" marker edited into the body
          body: `_⚠️ Potential issue_ | _🟡 Minor_

**Some issue description.**

Details here...

✅ Addressed in commit d929b07`,
          path: "file.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: {
            login: "coderabbitai[bot]",
            avatar_url: "https://example.com",
          },
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:01:00Z",
          in_reply_to_id: null,
          html_url: "https://github.com",
        },
      ],
    });
    mockOctokit.rest.checks.listForRef.mockResolvedValue({
      data: { check_runs: [] },
    });
    // GraphQL fails or returns no resolution status
    mockOctokit.graphql.mockRejectedValue(new Error("GraphQL error"));

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    // Thread should be marked as resolved based on "✅ Addressed" marker in comment body
    expect(feedback.comments.resolved.length).toBe(1);
    expect(feedback.comments.unresolved.length).toBe(0);
  });

  it("should identify coverage check", async () => {
    const prDetails = {
      html_url: "https://github.com/owner/repo/pull/123",
      title: "Test PR",
      draft: false,
      closed_at: null,
      merged_at: null,
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123" },
      mergeable: true,
      mergeable_state: "clean",
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });
    mockOctokit.rest.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            id: 1,
            name: "Build",
            status: "completed",
            conclusion: "success",
            started_at: "2024-01-01T00:00:00Z",
            completed_at: "2024-01-01T00:01:00Z",
            details_url: "https://example.com",
          },
          {
            id: 2,
            name: "Codecov/patch",
            status: "completed",
            conclusion: "success",
            started_at: "2024-01-01T00:00:00Z",
            completed_at: "2024-01-01T00:01:00Z",
            details_url: "https://codecov.io",
          },
        ],
      },
    });
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    expect(feedback.coverageCheck).not.toBeNull();
    expect(feedback.coverageCheck?.name).toBe("Codecov/patch");
  });

  it("should mark PR as not mergeable when mergeableState is unstable", async () => {
    const prDetails = createPRDetails({ mergeable_state: "unstable" });
    setupMinimalMocks(prDetails);

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    expect(feedback.mergeableState).toBe("unstable");
    expect(feedback.hasConflicts).toBe(false);
    expect(feedback.isMergeable).toBe(false);
  });

  it("should mark PR as not mergeable when mergeableState is blocked", async () => {
    const prDetails = createPRDetails({ mergeable_state: "blocked" });
    setupMinimalMocks(prDetails);

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    expect(feedback.mergeableState).toBe("blocked");
    expect(feedback.hasConflicts).toBe(false);
    expect(feedback.isMergeable).toBe(false);
  });
});

describe("fetch functions", () => {
  const mockOctokit = {
    rest: {
      pulls: {
        get: vi.fn(),
        listReviewComments: vi.fn(),
        listReviews: vi.fn(),
      },
      checks: {
        listForRef: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchPRComments should call the correct endpoint", async () => {
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });
    await fetchPRComments(mockOctokit as any, "owner", "repo", 123);
    expect(mockOctokit.rest.pulls.listReviewComments).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123,
      per_page: 100,
    });
  });

  it("fetchPRReviews should call the correct endpoint", async () => {
    mockOctokit.rest.pulls.listReviews.mockResolvedValue({ data: [] });
    await fetchPRReviews(mockOctokit as any, "owner", "repo", 123);
    expect(mockOctokit.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123,
      per_page: 100,
    });
  });

  it("fetchPRDetails should call the correct endpoint", async () => {
    mockOctokit.rest.pulls.get.mockResolvedValue({ data: {} });
    await fetchPRDetails(mockOctokit as any, "owner", "repo", 123);
    expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 123,
    });
  });

  it("fetchPRDetails should poll when mergeable state is computing", async () => {
    vi.useFakeTimers();
    const firstResponse = {
      data: { mergeable_state: null, mergeable: null },
    };
    const finalResponse = {
      data: { mergeable_state: "clean", mergeable: true },
    };
    mockOctokit.rest.pulls.get
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(finalResponse);

    try {
      const promise = fetchPRDetails(mockOctokit as any, "owner", "repo", 123);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(mockOctokit.rest.pulls.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual(finalResponse.data);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fetchPRDetails should skip polling when skipMergeablePolling is true", async () => {
    vi.useFakeTimers();
    const response = {
      data: { mergeable_state: null, mergeable: null },
    };
    mockOctokit.rest.pulls.get.mockResolvedValueOnce(response);

    try {
      const promise = fetchPRDetails(mockOctokit as any, "owner", "repo", 123, {
        skipMergeablePolling: true,
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      // Should only call once and return immediately without polling
      expect(mockOctokit.rest.pulls.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual(response.data);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fetchPRChecks should call the correct endpoint", async () => {
    mockOctokit.rest.checks.listForRef.mockResolvedValue({ data: {} });
    await fetchPRChecks(mockOctokit as any, "owner", "repo", "abc123");
    expect(mockOctokit.rest.checks.listForRef).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      ref: "abc123",
      per_page: 100,
    });
  });
});

describe("feedbackQueuedAt time check (in-progress comments)", () => {
  const mockOctokit = {
    rest: {
      pulls: {
        get: vi.fn(),
        listReviewComments: vi.fn(),
        listReviews: vi.fn(),
      },
      checks: {
        listForRef: vi.fn(),
      },
    },
    graphql: vi.fn(),
  };

  const createPRDetails = () => ({
    html_url: "https://github.com/owner/repo/pull/123",
    title: "Test PR",
    draft: false,
    closed_at: null,
    merged_at: null,
    base: { ref: "main" },
    head: { ref: "feature", sha: "abc123" },
    mergeable: true,
    mergeable_state: "clean",
    auto_merge: null,
  });

  const setupMinimalMocks = () => {
    mockOctokit.rest.pulls.get.mockResolvedValue({ data: createPRDetails() });
    mockOctokit.rest.checks.listForRef.mockResolvedValue({
      data: { check_runs: [] },
    });
    // GraphQL returns no resolution status
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should mark unresolved comments as in-progress when feedbackQueuedAt is after comment creation", async () => {
    const commentCreatedAt = "2024-01-01T10:00:00Z"; // Comment created at 10:00
    const feedbackQueuedAt = new Date("2024-01-01T12:00:00Z"); // Feedback queued at 12:00 (after comment)

    setupMinimalMocks();
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          body: "Please fix this",
          path: "file.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: { login: "reviewer", avatar_url: "https://example.com" },
          created_at: commentCreatedAt,
          updated_at: commentCreatedAt,
          in_reply_to_id: null,
          html_url: "https://github.com/owner/repo/pull/123#comment-1",
        },
      ],
    });

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
      { feedbackQueuedAt },
    );

    // Comment should be unresolved but marked as in-progress
    expect(feedback.comments.unresolved).toHaveLength(1);
    expect(feedback.comments.unresolved[0]!.isResolved).toBe(false);
    expect(feedback.comments.unresolved[0]!.isInProgress).toBe(true);
    expect(feedback.comments.inProgress).toHaveLength(1);
  });

  it("should NOT mark comments as in-progress when feedbackQueuedAt is before comment creation", async () => {
    const commentCreatedAt = "2024-01-01T14:00:00Z"; // Comment created at 14:00
    const feedbackQueuedAt = new Date("2024-01-01T12:00:00Z"); // Feedback queued at 12:00 (before comment)

    setupMinimalMocks();
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          body: "Please fix this",
          path: "file.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: { login: "reviewer", avatar_url: "https://example.com" },
          created_at: commentCreatedAt,
          updated_at: commentCreatedAt,
          in_reply_to_id: null,
          html_url: "https://github.com/owner/repo/pull/123#comment-1",
        },
      ],
    });

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
      { feedbackQueuedAt },
    );

    // Comment should be unresolved and NOT in-progress (created after feedback was queued)
    expect(feedback.comments.unresolved).toHaveLength(1);
    expect(feedback.comments.unresolved[0]!.isResolved).toBe(false);
    expect(feedback.comments.unresolved[0]!.isInProgress).toBe(false);
    expect(feedback.comments.inProgress).toHaveLength(0);
  });

  it("should NOT mark resolved comments as in-progress", async () => {
    const commentCreatedAt = "2024-01-01T10:00:00Z";
    const feedbackQueuedAt = new Date("2024-01-01T12:00:00Z");

    setupMinimalMocks();
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          body: "Done", // Has resolution keyword
          path: "file.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: { login: "author", avatar_url: "https://example.com" },
          created_at: commentCreatedAt,
          updated_at: commentCreatedAt,
          in_reply_to_id: null,
          html_url: "https://github.com/owner/repo/pull/123#comment-1",
        },
      ],
    });

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
      { feedbackQueuedAt },
    );

    // Comment is resolved (has "Done" keyword), so it should NOT be in inProgress
    expect(feedback.comments.resolved).toHaveLength(1);
    expect(feedback.comments.unresolved).toHaveLength(0);
    expect(feedback.comments.inProgress).toHaveLength(0);
  });

  it("should handle null feedbackQueuedAt (no comments in-progress)", async () => {
    const commentCreatedAt = "2024-01-01T10:00:00Z";

    setupMinimalMocks();
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          body: "Please fix this",
          path: "file.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: { login: "reviewer", avatar_url: "https://example.com" },
          created_at: commentCreatedAt,
          updated_at: commentCreatedAt,
          in_reply_to_id: null,
          html_url: "https://github.com/owner/repo/pull/123#comment-1",
        },
      ],
    });

    // No feedbackQueuedAt provided
    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    // Comment should be unresolved but NOT in-progress (no feedbackQueuedAt)
    expect(feedback.comments.unresolved).toHaveLength(1);
    expect(feedback.comments.unresolved[0]!.isInProgress).toBe(false);
    expect(feedback.comments.inProgress).toHaveLength(0);
  });

  it("should mark multiple older comments as in-progress and leave newer ones not in-progress", async () => {
    const oldCommentCreatedAt = "2024-01-01T10:00:00Z"; // Before feedback queued
    const newCommentCreatedAt = "2024-01-01T14:00:00Z"; // After feedback queued
    const feedbackQueuedAt = new Date("2024-01-01T12:00:00Z");

    setupMinimalMocks();
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          body: "Please fix this (old comment)",
          path: "file1.ts",
          line: 10,
          original_line: 10,
          side: "RIGHT",
          user: { login: "reviewer1", avatar_url: "https://example.com" },
          created_at: oldCommentCreatedAt,
          updated_at: oldCommentCreatedAt,
          in_reply_to_id: null,
          html_url: "https://github.com/owner/repo/pull/123#comment-1",
        },
        {
          id: 2,
          body: "Also fix this (new comment)",
          path: "file2.ts",
          line: 20,
          original_line: 20,
          side: "RIGHT",
          user: { login: "reviewer2", avatar_url: "https://example.com" },
          created_at: newCommentCreatedAt,
          updated_at: newCommentCreatedAt,
          in_reply_to_id: null,
          html_url: "https://github.com/owner/repo/pull/123#comment-2",
        },
      ],
    });

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
      { feedbackQueuedAt },
    );

    // Both comments are unresolved
    expect(feedback.comments.unresolved).toHaveLength(2);
    // Only the old comment (created before feedbackQueuedAt) should be in-progress
    expect(feedback.comments.inProgress).toHaveLength(1);
    expect(feedback.comments.inProgress[0]!.comments[0]!.body).toContain(
      "old comment",
    );
  });
});
