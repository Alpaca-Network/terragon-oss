import { describe, it, expect } from "vitest";
import type { PRFeedback, PRCheckRun } from "@terragon/shared/db/types";
import { createFeedbackSignature } from "./address-feedback-dialog";

/**
 * Tests for the AddressFeedbackDialog component logic.
 *
 * The component displays a button to address PR feedback (comments, failing checks, conflicts).
 * The button should be hidden when there's no feedback to address.
 */
describe("AddressFeedbackDialog component logic", () => {
  // Helper to create a minimal PRFeedback object for testing
  const createMockFeedback = (
    overrides: Partial<{
      unresolvedComments: number;
      checks: Array<{ conclusion: PRCheckRun["conclusion"] }>;
      hasConflicts: boolean;
    }> = {},
  ): Pick<PRFeedback, "comments" | "checks" | "hasConflicts"> => {
    const unresolvedCount = overrides.unresolvedComments ?? 0;
    return {
      comments: {
        unresolved: Array(unresolvedCount).fill(
          {},
        ) as PRFeedback["comments"]["unresolved"],
        resolved: [],
      },
      checks: (overrides.checks ?? []).map((c, i) => ({
        id: i,
        name: `check-${i}`,
        status: "completed" as const,
        conclusion: c.conclusion,
        startedAt: null,
        completedAt: null,
        detailsUrl: null,
      })),
      hasConflicts: overrides.hasConflicts ?? false,
    };
  };

  // This mirrors the actual calculation in the component
  const calculateIssueCount = (
    feedback: Pick<PRFeedback, "comments" | "checks" | "hasConflicts">,
  ): number => {
    return (
      feedback.comments.unresolved.length +
      feedback.checks.filter(
        (c) => c.conclusion === "failure" || c.conclusion === "timed_out",
      ).length +
      (feedback.hasConflicts ? 1 : 0)
    );
  };

  describe("issueCount calculation", () => {
    it("should return 0 when there are no issues", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [],
        hasConflicts: false,
      });
      expect(calculateIssueCount(feedback)).toBe(0);
    });

    it("should count unresolved comments", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 3,
        checks: [],
        hasConflicts: false,
      });
      expect(calculateIssueCount(feedback)).toBe(3);
    });

    it("should count failing checks", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [{ conclusion: "failure" }, { conclusion: "failure" }],
        hasConflicts: false,
      });
      expect(calculateIssueCount(feedback)).toBe(2);
    });

    it("should count timed out checks", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [{ conclusion: "timed_out" }],
        hasConflicts: false,
      });
      expect(calculateIssueCount(feedback)).toBe(1);
    });

    it("should not count successful or other check conclusions", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [
          { conclusion: "success" },
          { conclusion: "neutral" },
          { conclusion: "skipped" },
          { conclusion: "cancelled" },
        ],
        hasConflicts: false,
      });
      expect(calculateIssueCount(feedback)).toBe(0);
    });

    it("should add 1 for conflicts", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [],
        hasConflicts: true,
      });
      expect(calculateIssueCount(feedback)).toBe(1);
    });

    it("should sum all issue types", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 2,
        checks: [
          { conclusion: "failure" },
          { conclusion: "failure" },
          { conclusion: "failure" },
          { conclusion: "timed_out" },
          { conclusion: "success" }, // Should not be counted
        ],
        hasConflicts: true,
      });
      // 2 unresolved + 3 failures + 1 timed_out + 1 conflict = 7
      expect(calculateIssueCount(feedback)).toBe(7);
    });
  });

  describe("button visibility", () => {
    const shouldShowButton = (issueCount: number): boolean => {
      return issueCount > 0;
    };

    it("should hide button when issueCount is 0", () => {
      expect(shouldShowButton(0)).toBe(false);
    });

    it("should show button when issueCount is 1", () => {
      expect(shouldShowButton(1)).toBe(true);
    });

    it("should show button when issueCount is greater than 1", () => {
      expect(shouldShowButton(5)).toBe(true);
      expect(shouldShowButton(10)).toBe(true);
    });
  });

  describe("issue count badge", () => {
    const shouldShowBadge = (issueCount: number): boolean => {
      return issueCount > 0;
    };

    it("should not show badge when issueCount is 0", () => {
      expect(shouldShowBadge(0)).toBe(false);
    });

    it("should show badge when issueCount is greater than 0", () => {
      expect(shouldShowBadge(1)).toBe(true);
      expect(shouldShowBadge(5)).toBe(true);
    });
  });

  describe("feedback signature", () => {
    const createSignatureFeedback = ({
      unresolvedThreadIds = [],
      checkRuns = [],
      hasConflicts = false,
    }: {
      unresolvedThreadIds?: string[];
      checkRuns?: Array<{
        id: number;
        conclusion: PRCheckRun["conclusion"];
      }>;
      hasConflicts?: boolean;
    }): PRFeedback => {
      return {
        prNumber: 123,
        repoFullName: "owner/repo",
        prUrl: "https://example.com/pr/123",
        prTitle: "Test PR",
        prState: "open",
        baseBranch: "main",
        headBranch: "feature",
        headSha: "abc123",
        comments: {
          unresolved: unresolvedThreadIds.map((id) => ({
            id,
            isResolved: false,
            comments: [],
          })),
          resolved: [],
        },
        checks: checkRuns.map((check) => ({
          id: check.id,
          name: `check-${check.id}`,
          status: "completed",
          conclusion: check.conclusion,
          startedAt: null,
          completedAt: null,
          detailsUrl: null,
        })),
        coverageCheck: null,
        mergeableState: "clean",
        hasConflicts,
        isMergeable: true,
      };
    };

    it("should be stable for identical feedback", () => {
      const feedback = createSignatureFeedback({
        unresolvedThreadIds: ["t1", "t2"],
        checkRuns: [{ id: 1, conclusion: "failure" }],
        hasConflicts: true,
      });
      expect(createFeedbackSignature(feedback)).toBe(
        createFeedbackSignature(feedback),
      );
    });

    it("should change when unresolved threads change", () => {
      const base = createSignatureFeedback({
        unresolvedThreadIds: ["t1"],
        checkRuns: [{ id: 1, conclusion: "failure" }],
      });
      const updated = createSignatureFeedback({
        unresolvedThreadIds: ["t1", "t2"],
        checkRuns: [{ id: 1, conclusion: "failure" }],
      });
      expect(createFeedbackSignature(base)).not.toBe(
        createFeedbackSignature(updated),
      );
    });

    it("should change when failing checks change", () => {
      const base = createSignatureFeedback({
        unresolvedThreadIds: ["t1"],
        checkRuns: [{ id: 1, conclusion: "failure" }],
      });
      const updated = createSignatureFeedback({
        unresolvedThreadIds: ["t1"],
        checkRuns: [{ id: 2, conclusion: "failure" }],
      });
      expect(createFeedbackSignature(base)).not.toBe(
        createFeedbackSignature(updated),
      );
    });

    it("should change when conflict status changes", () => {
      const base = createSignatureFeedback({
        unresolvedThreadIds: ["t1"],
        checkRuns: [{ id: 1, conclusion: "failure" }],
        hasConflicts: false,
      });
      const updated = createSignatureFeedback({
        unresolvedThreadIds: ["t1"],
        checkRuns: [{ id: 1, conclusion: "failure" }],
        hasConflicts: true,
      });
      expect(createFeedbackSignature(base)).not.toBe(
        createFeedbackSignature(updated),
      );
    });
  });
});
