import { describe, expect, it } from "vitest";
import {
  generateFeedbackTaskDescription,
  createFeedbackSummaryText,
} from "./feedback-task-template";
import type {
  PRFeedback,
  PRCheckRun,
  PRReviewThread,
} from "@terragon/shared/db/types";

describe("generateFeedbackTaskDescription", () => {
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
    comments: Array<{
      body: string;
      path: string;
      line?: number;
      author?: string;
    }>,
  ): PRReviewThread => ({
    id: String(Math.floor(Math.random() * 1000)),
    isResolved: false,
    isInProgress: false,
    comments: comments.map((c, i) => ({
      id: i,
      body: c.body,
      path: c.path,
      line: c.line ?? null,
      originalLine: c.line ?? null,
      side: "RIGHT" as const,
      author: {
        login: c.author ?? "reviewer",
        avatarUrl: "https://example.com/avatar",
      },
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      htmlUrl: "https://github.com/owner/repo/pull/123#comment-1",
    })),
  });

  const createCheck = (
    name: string,
    conclusion: PRCheckRun["conclusion"],
    summary?: string,
  ): PRCheckRun => ({
    id: Math.floor(Math.random() * 1000),
    name,
    status: "completed",
    conclusion,
    startedAt: "2024-01-01T00:00:00Z",
    completedAt: "2024-01-01T00:01:00Z",
    detailsUrl: "https://example.com/check",
    output: summary ? { title: name, summary } : undefined,
  });

  it("should include PR context", () => {
    const feedback = createBaseFeedback();
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("PR: https://github.com/owner/repo/pull/123");
    expect(result).toContain("Branch: feature → main");
  });

  it("should include unresolved comments", () => {
    const feedback = createBaseFeedback({
      comments: {
        unresolved: [
          createThread([
            { body: "Please fix this", path: "src/app.ts", line: 42 },
          ]),
        ],
        resolved: [],
        inProgress: [],
      },
    });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("## PR Comments (1 unresolved)");
    expect(result).toContain("**src/app.ts:42**");
    expect(result).toContain("@reviewer");
    expect(result).toContain("Please fix this");
  });

  it("should truncate long comments", () => {
    const longBody = "A".repeat(250);
    const feedback = createBaseFeedback({
      comments: {
        unresolved: [
          createThread([{ body: longBody, path: "file.ts", line: 1 }]),
        ],
        resolved: [],
        inProgress: [],
      },
    });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("...");
    expect(result).not.toContain(longBody);
  });

  it("should show reply count for threads with multiple comments", () => {
    const feedback = createBaseFeedback({
      comments: {
        unresolved: [
          createThread([
            { body: "Comment 1", path: "file.ts", line: 1 },
            { body: "Reply 1", path: "file.ts", line: 1 },
            { body: "Reply 2", path: "file.ts", line: 1 },
          ]),
        ],
        resolved: [],
        inProgress: [],
      },
    });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("_2 replies_");
  });

  it("should use singular 'reply' for one reply", () => {
    const feedback = createBaseFeedback({
      comments: {
        unresolved: [
          createThread([
            { body: "Comment 1", path: "file.ts", line: 1 },
            { body: "Reply 1", path: "file.ts", line: 1 },
          ]),
        ],
        resolved: [],
        inProgress: [],
      },
    });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("_1 reply_");
  });

  it("should include failing checks with correct icons", () => {
    const feedback = createBaseFeedback({
      checks: [
        createCheck("Build", "failure", "Build failed"),
        createCheck("Test", "timed_out"),
        createCheck("Lint", "cancelled"),
        createCheck("Deploy", "success"),
      ],
    });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("## Failing Checks (3)");
    expect(result).toContain("❌ **Build**");
    expect(result).toContain("Build failed");
    expect(result).toContain("⏱️ **Test**");
    expect(result).toContain("⚪ **Lint**");
    expect(result).not.toContain("Deploy");
  });

  it("should include check details URL", () => {
    const feedback = createBaseFeedback({
      checks: [createCheck("Build", "failure")],
    });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("Details: https://example.com/check");
  });

  it("should include coverage section when coverage check exists", () => {
    const coverageCheck = createCheck("Codecov", "success", "Coverage: 85%");
    const feedback = createBaseFeedback({ coverageCheck });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("## Coverage");
    expect(result).toContain("Status: ✅ Passing");
    expect(result).toContain("Coverage: 85%");
  });

  it("should show failing coverage status", () => {
    const coverageCheck = createCheck("Codecov", "failure", "Coverage dropped");
    const feedback = createBaseFeedback({ coverageCheck });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("Status: ❌ Failing");
  });

  it("should include merge conflicts section when conflicts exist", () => {
    const feedback = createBaseFeedback({
      hasConflicts: true,
      isMergeable: false,
    });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("## ⚠️ Merge Conflicts");
    expect(result).toContain("merge conflicts with `main`");
    expect(result).toContain("To resolve:");
    expect(result).toContain("1. Pull latest changes");
  });

  it("should generate correct instruction tasks", () => {
    const feedback = createBaseFeedback({
      comments: {
        unresolved: [
          createThread([{ body: "Fix this", path: "file.ts", line: 1 }]),
        ],
        resolved: [],
        inProgress: [],
      },
      checks: [createCheck("Build", "failure")],
      coverageCheck: createCheck("Codecov", "failure"),
      hasConflicts: true,
    });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("## Instructions");
    expect(result).toContain("- Review and address each PR comment");
    expect(result).toContain("- Fix the failing CI checks");
    expect(result).toContain("- Improve test coverage to meet requirements");
    expect(result).toContain("- Resolve merge conflicts with the base branch");
  });

  it("should include merge instructions when requested", () => {
    const feedback = createBaseFeedback({
      isMergeable: true,
      hasConflicts: false,
    });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: true,
    });
    expect(result).toContain("## After Addressing Feedback");
    expect(result).toContain("merge the PR");
    expect(result).toContain("currently mergeable");
  });

  it("should not mention mergeability when PR has conflicts", () => {
    const feedback = createBaseFeedback({
      isMergeable: false,
      hasConflicts: true,
    });
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: true,
    });
    expect(result).toContain("## After Addressing Feedback");
    expect(result).not.toContain("currently mergeable");
  });

  it("should handle feedback with no issues", () => {
    const feedback = createBaseFeedback();
    const result = generateFeedbackTaskDescription(feedback, {
      includeMergeInstructions: false,
    });
    expect(result).toContain("PR:");
    expect(result).toContain("## Instructions");
    expect(result).not.toContain("## PR Comments");
    expect(result).not.toContain("## Failing Checks");
    expect(result).not.toContain("## Coverage");
    expect(result).not.toContain("## ⚠️ Merge Conflicts");
  });
});

describe("createFeedbackSummaryText", () => {
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

  const createThread = (commentCount: number): PRReviewThread => ({
    id: String(Math.floor(Math.random() * 1000)),
    isResolved: false,
    isInProgress: false,
    comments: Array.from({ length: commentCount }, (_, i) => ({
      id: i,
      body: `Comment ${i}`,
      path: "file.ts",
      line: i + 1,
      originalLine: i + 1,
      side: "RIGHT" as const,
      author: { login: "user", avatarUrl: "https://example.com" },
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      htmlUrl: "https://github.com",
    })),
  });

  const createCheck = (conclusion: PRCheckRun["conclusion"]): PRCheckRun => ({
    id: Math.floor(Math.random() * 1000),
    name: "Check",
    status: "completed",
    conclusion,
    startedAt: "2024-01-01T00:00:00Z",
    completedAt: "2024-01-01T00:01:00Z",
    detailsUrl: "https://example.com",
  });

  it("should return 'No issues found' when no issues", () => {
    const feedback = createBaseFeedback();
    expect(createFeedbackSummaryText(feedback)).toBe("No issues found");
  });

  it("should count unresolved comments with correct pluralization", () => {
    const feedbackSingle = createBaseFeedback({
      comments: { unresolved: [createThread(1)], resolved: [], inProgress: [] },
    });
    expect(createFeedbackSummaryText(feedbackSingle)).toBe("1 comment");

    const feedbackMultiple = createBaseFeedback({
      comments: {
        unresolved: [createThread(2), createThread(3)],
        resolved: [],
        inProgress: [],
      },
    });
    expect(createFeedbackSummaryText(feedbackMultiple)).toBe("5 comments");
  });

  it("should count failing checks with correct pluralization", () => {
    const feedbackSingle = createBaseFeedback({
      checks: [createCheck("failure")],
    });
    expect(createFeedbackSummaryText(feedbackSingle)).toBe("1 failing check");

    const feedbackMultiple = createBaseFeedback({
      checks: [
        createCheck("failure"),
        createCheck("timed_out"),
        createCheck("success"),
      ],
    });
    expect(createFeedbackSummaryText(feedbackMultiple)).toBe(
      "2 failing checks",
    );
  });

  it("should include merge conflicts", () => {
    const feedback = createBaseFeedback({ hasConflicts: true });
    expect(createFeedbackSummaryText(feedback)).toBe("merge conflicts");
  });

  it("should combine multiple issues with commas", () => {
    const feedback = createBaseFeedback({
      comments: { unresolved: [createThread(2)], resolved: [], inProgress: [] },
      checks: [createCheck("failure")],
      hasConflicts: true,
    });
    expect(createFeedbackSummaryText(feedback)).toBe(
      "2 comments, 1 failing check, merge conflicts",
    );
  });

  it("should not count cancelled checks as failing", () => {
    const feedback = createBaseFeedback({
      checks: [createCheck("cancelled"), createCheck("success")],
    });
    expect(createFeedbackSummaryText(feedback)).toBe("No issues found");
  });
});
