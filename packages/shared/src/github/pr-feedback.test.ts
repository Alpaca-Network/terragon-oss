import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  extractCoverageCheck,
  createFeedbackSummary,
  aggregatePRFeedback,
  fetchPRComments,
  fetchPRReviews,
  fetchPRDetails,
  fetchPRChecks,
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
    comments: { unresolved: [], resolved: [] },
    checks: [],
    coverageCheck: null,
    mergeableState: "clean",
    hasConflicts: false,
    isMergeable: true,
    ...overrides,
  });

  const createThread = (
    commentCount: number,
    isResolved = false,
  ): PRReviewThread => ({
    id: String(Math.floor(Math.random() * 1000)),
    isResolved,
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
    const prDetails = {
      html_url: "https://github.com/owner/repo/pull/123",
      title: "Test PR",
      draft: false,
      closed_at: null,
      merged_at: null,
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123" },
      mergeable: false,
      mergeable_state: "dirty",
    };

    mockOctokit.rest.pulls.get.mockResolvedValue({ data: prDetails });
    mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });
    mockOctokit.rest.checks.listForRef.mockResolvedValue({
      data: { check_runs: [] },
    });

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

  it("should group comment threads correctly", async () => {
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

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    // Thread should be marked as resolved because last comment says "Done"
    expect(feedback.comments.resolved.length).toBe(1);
    expect(feedback.comments.resolved[0]!.comments.length).toBe(2);
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

    const feedback = await aggregatePRFeedback(
      mockOctokit as any,
      "owner",
      "repo",
      123,
    );

    expect(feedback.coverageCheck).not.toBeNull();
    expect(feedback.coverageCheck?.name).toBe("Codecov/patch");
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
