import { describe, it, expect } from "vitest";
import { combinePRFeedbackFromQueries } from "../use-pr-feedback";
import type { GetPRHeaderResult } from "@/server-actions/get-pr-header";
import type { GetPRCommentsResult } from "@/server-actions/get-pr-comments";
import type { GetPRChecksResult } from "@/server-actions/get-pr-checks";

describe("combinePRFeedbackFromQueries", () => {
  const mockHeader: GetPRHeaderResult = {
    prNumber: 123,
    repoFullName: "owner/repo",
    prUrl: "https://github.com/owner/repo/pull/123",
    prTitle: "Test PR",
    prState: "open",
    baseBranch: "main",
    headBranch: "feature",
    headSha: "abc123",
    mergeableState: "clean",
    hasConflicts: false,
    isMergeable: true,
    isAutoMergeEnabled: false,
  };

  const mockComments: GetPRCommentsResult = {
    comments: {
      unresolved: [
        {
          id: "thread-1",
          isResolved: false,
          isInProgress: false,
          comments: [
            {
              id: 1,
              body: "Please fix this",
              path: "src/file.ts",
              line: 10,
              originalLine: 10,
              side: "RIGHT",
              author: { login: "reviewer", avatarUrl: "" },
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
              htmlUrl: "https://github.com/...",
            },
          ],
        },
      ],
      resolved: [],
      inProgress: [],
    },
    summary: {
      unresolvedCount: 1,
      resolvedCount: 0,
      inProgressCount: 0,
    },
  };

  const mockChecks: GetPRChecksResult = {
    checks: [
      {
        id: 1,
        name: "CI",
        status: "completed",
        conclusion: "success",
        startedAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:05:00Z",
        detailsUrl: "https://github.com/...",
      },
    ],
    coverageCheck: null,
    summary: {
      failingCount: 0,
      pendingCount: 0,
      passingCount: 1,
      hasCoverageCheck: false,
      coverageCheckPassed: null,
    },
  };

  it("should return null when header is undefined", () => {
    const result = combinePRFeedbackFromQueries(
      undefined,
      mockComments,
      mockChecks,
    );
    expect(result).toBeNull();
  });

  it("should combine header, comments, and checks into full feedback object", () => {
    const result = combinePRFeedbackFromQueries(
      mockHeader,
      mockComments,
      mockChecks,
    );

    expect(result).not.toBeNull();
    expect(result?.prNumber).toBe(123);
    expect(result?.prTitle).toBe("Test PR");
    expect(result?.headSha).toBe("abc123");
    expect(result?.comments.unresolved).toHaveLength(1);
    expect(result?.checks).toHaveLength(1);
    expect(result?.hasConflicts).toBe(false);
    expect(result?.isMergeable).toBe(true);
  });

  it("should handle missing comments gracefully", () => {
    const result = combinePRFeedbackFromQueries(
      mockHeader,
      undefined,
      mockChecks,
    );

    expect(result).not.toBeNull();
    expect(result?.comments).toEqual({
      unresolved: [],
      resolved: [],
      inProgress: [],
    });
    expect(result?.checks).toHaveLength(1);
  });

  it("should handle missing checks gracefully", () => {
    const result = combinePRFeedbackFromQueries(
      mockHeader,
      mockComments,
      undefined,
    );

    expect(result).not.toBeNull();
    expect(result?.comments.unresolved).toHaveLength(1);
    expect(result?.checks).toEqual([]);
    expect(result?.coverageCheck).toBeNull();
  });

  it("should handle all optional data missing", () => {
    const result = combinePRFeedbackFromQueries(
      mockHeader,
      undefined,
      undefined,
    );

    expect(result).not.toBeNull();
    expect(result?.prNumber).toBe(123);
    expect(result?.comments).toEqual({
      unresolved: [],
      resolved: [],
      inProgress: [],
    });
    expect(result?.checks).toEqual([]);
    expect(result?.coverageCheck).toBeNull();
    expect(result?.isMergeable).toBe(true);
  });

  it("should preserve header fields accurately", () => {
    const headerWithConflicts: GetPRHeaderResult = {
      ...mockHeader,
      mergeableState: "dirty",
      hasConflicts: true,
      isMergeable: false,
      isAutoMergeEnabled: true,
    };

    const result = combinePRFeedbackFromQueries(
      headerWithConflicts,
      mockComments,
      mockChecks,
    );

    expect(result?.mergeableState).toBe("dirty");
    expect(result?.hasConflicts).toBe(true);
    expect(result?.isMergeable).toBe(false);
    expect(result?.isAutoMergeEnabled).toBe(true);
  });
});
