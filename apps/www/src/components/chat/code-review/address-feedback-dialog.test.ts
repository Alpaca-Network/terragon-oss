import { describe, it, expect } from "vitest";
import type { PRFeedback, PRCheckRun } from "@terragon/shared/db/types";
import type { AIModel } from "@terragon/agent/types";
import { resolveFeedbackTaskModel } from "./address-feedback-dialog";

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
        inProgress: [],
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

  describe("model selection behavior", () => {
    const defaultModel: AIModel = "sonnet";
    const taskModel: AIModel = "opus";

    it("should use the task model for new tasks", () => {
      const result = resolveFeedbackTaskModel({
        mode: "new-task",
        defaultModel,
        taskModel,
      });
      expect(result).toBe(taskModel);
    });

    it("should use the default model when adding to the queue", () => {
      const result = resolveFeedbackTaskModel({
        mode: "integrate",
        defaultModel,
        taskModel,
      });
      expect(result).toBe(defaultModel);
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

  describe("automerge eligibility", () => {
    // This mirrors the actual calculation in the component for canEnableAutoMerge
    const canEnableAutoMerge = (
      feedback: Pick<PRFeedback, "comments" | "checks" | "hasConflicts">,
    ): boolean => {
      const allChecksPassed = feedback.checks.every(
        (c) =>
          c.conclusion === "success" ||
          c.conclusion === "neutral" ||
          c.conclusion === "skipped",
      );
      const hasNoUnresolvedComments = feedback.comments.unresolved.length === 0;
      return (
        allChecksPassed && hasNoUnresolvedComments && !feedback.hasConflicts
      );
    };

    it("should allow automerge when all checks pass and no unresolved comments", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [{ conclusion: "success" }, { conclusion: "success" }],
        hasConflicts: false,
      });
      expect(canEnableAutoMerge(feedback)).toBe(true);
    });

    it("should allow automerge when checks are neutral or skipped", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [
          { conclusion: "success" },
          { conclusion: "neutral" },
          { conclusion: "skipped" },
        ],
        hasConflicts: false,
      });
      expect(canEnableAutoMerge(feedback)).toBe(true);
    });

    it("should allow automerge when there are no checks", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [],
        hasConflicts: false,
      });
      expect(canEnableAutoMerge(feedback)).toBe(true);
    });

    it("should not allow automerge when there are unresolved comments", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 2,
        checks: [{ conclusion: "success" }],
        hasConflicts: false,
      });
      expect(canEnableAutoMerge(feedback)).toBe(false);
    });

    it("should not allow automerge when there are failing checks", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [{ conclusion: "failure" }],
        hasConflicts: false,
      });
      expect(canEnableAutoMerge(feedback)).toBe(false);
    });

    it("should not allow automerge when there are timed out checks", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [{ conclusion: "timed_out" }],
        hasConflicts: false,
      });
      expect(canEnableAutoMerge(feedback)).toBe(false);
    });

    it("should not allow automerge when there are conflicts", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [{ conclusion: "success" }],
        hasConflicts: true,
      });
      expect(canEnableAutoMerge(feedback)).toBe(false);
    });

    it("should not allow automerge when checks are cancelled", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 0,
        checks: [{ conclusion: "cancelled" }],
        hasConflicts: false,
      });
      expect(canEnableAutoMerge(feedback)).toBe(false);
    });

    it("should not allow automerge with multiple issues", () => {
      const feedback = createMockFeedback({
        unresolvedComments: 1,
        checks: [{ conclusion: "failure" }],
        hasConflicts: true,
      });
      expect(canEnableAutoMerge(feedback)).toBe(false);
    });
  });
});
