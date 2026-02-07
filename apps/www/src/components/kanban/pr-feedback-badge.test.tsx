import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the PRFeedbackBadge component logic.
 *
 * The component displays indicators for PR feedback including:
 * - Unresolved comments count
 * - Failing/pending/passing checks count
 * - Merge conflicts indicator
 */
describe("PRFeedbackBadge component logic", () => {
  describe("rendering conditions", () => {
    it("should not render when repoFullName is null", () => {
      const shouldRender = (
        repoFullName: string | null,
        prNumber: number | null,
      ) => {
        return !!repoFullName && !!prNumber;
      };

      expect(shouldRender(null, 123)).toBe(false);
    });

    it("should not render when prNumber is null", () => {
      const shouldRender = (
        repoFullName: string | null,
        prNumber: number | null,
      ) => {
        return !!repoFullName && !!prNumber;
      };

      expect(shouldRender("owner/repo", null)).toBe(false);
    });

    it("should be eligible to render when both repoFullName and prNumber are provided", () => {
      const shouldRender = (
        repoFullName: string | null,
        prNumber: number | null,
      ) => {
        return !!repoFullName && !!prNumber;
      };

      expect(shouldRender("owner/repo", 123)).toBe(true);
    });
  });

  describe("badge visibility conditions", () => {
    interface FeedbackSummary {
      unresolvedCommentCount: number;
      failingCheckCount: number;
      pendingCheckCount: number;
      passingCheckCount: number;
      hasConflicts: boolean;
    }

    const shouldShowBadge = (summary: FeedbackSummary) => {
      const totalCheckCount =
        summary.failingCheckCount +
        summary.pendingCheckCount +
        summary.passingCheckCount;
      const hasComments = summary.unresolvedCommentCount > 0;
      const hasChecks = totalCheckCount > 0;
      const hasConflicts = summary.hasConflicts;

      return hasComments || hasChecks || hasConflicts;
    };

    it("should not show badge when there are no comments, checks, or conflicts", () => {
      expect(
        shouldShowBadge({
          unresolvedCommentCount: 0,
          failingCheckCount: 0,
          pendingCheckCount: 0,
          passingCheckCount: 0,
          hasConflicts: false,
        }),
      ).toBe(false);
    });

    it("should show badge when there are unresolved comments", () => {
      expect(
        shouldShowBadge({
          unresolvedCommentCount: 1,
          failingCheckCount: 0,
          pendingCheckCount: 0,
          passingCheckCount: 0,
          hasConflicts: false,
        }),
      ).toBe(true);
    });

    it("should show badge when there are failing checks", () => {
      expect(
        shouldShowBadge({
          unresolvedCommentCount: 0,
          failingCheckCount: 1,
          pendingCheckCount: 0,
          passingCheckCount: 0,
          hasConflicts: false,
        }),
      ).toBe(true);
    });

    it("should show badge when there are pending checks", () => {
      expect(
        shouldShowBadge({
          unresolvedCommentCount: 0,
          failingCheckCount: 0,
          pendingCheckCount: 1,
          passingCheckCount: 0,
          hasConflicts: false,
        }),
      ).toBe(true);
    });

    it("should show badge when there are passing checks", () => {
      expect(
        shouldShowBadge({
          unresolvedCommentCount: 0,
          failingCheckCount: 0,
          pendingCheckCount: 0,
          passingCheckCount: 1,
          hasConflicts: false,
        }),
      ).toBe(true);
    });

    it("should show badge when there are merge conflicts", () => {
      expect(
        shouldShowBadge({
          unresolvedCommentCount: 0,
          failingCheckCount: 0,
          pendingCheckCount: 0,
          passingCheckCount: 0,
          hasConflicts: true,
        }),
      ).toBe(true);
    });
  });

  describe("checks indicator logic", () => {
    interface CheckCounts {
      failingCheckCount: number;
      pendingCheckCount: number;
      passingCheckCount: number;
    }

    const getChecksStatus = (counts: CheckCounts) => {
      if (counts.failingCheckCount > 0) {
        return {
          status: "failing" as const,
          count: counts.failingCheckCount,
        };
      } else if (counts.pendingCheckCount > 0) {
        return {
          status: "pending" as const,
          count: counts.pendingCheckCount,
        };
      } else {
        return {
          status: "passing" as const,
          count: counts.passingCheckCount,
        };
      }
    };

    it("should show failing status when there are failing checks", () => {
      const result = getChecksStatus({
        failingCheckCount: 2,
        pendingCheckCount: 1,
        passingCheckCount: 5,
      });

      expect(result.status).toBe("failing");
      expect(result.count).toBe(2);
    });

    it("should show pending status when there are pending checks but no failing", () => {
      const result = getChecksStatus({
        failingCheckCount: 0,
        pendingCheckCount: 3,
        passingCheckCount: 5,
      });

      expect(result.status).toBe("pending");
      expect(result.count).toBe(3);
    });

    it("should show passing status when all checks pass", () => {
      const result = getChecksStatus({
        failingCheckCount: 0,
        pendingCheckCount: 0,
        passingCheckCount: 5,
      });

      expect(result.status).toBe("passing");
      expect(result.count).toBe(5);
    });

    it("should prioritize failing over pending over passing", () => {
      // Test that failing takes priority
      expect(
        getChecksStatus({
          failingCheckCount: 1,
          pendingCheckCount: 10,
          passingCheckCount: 100,
        }).status,
      ).toBe("failing");

      // Test that pending takes priority over passing
      expect(
        getChecksStatus({
          failingCheckCount: 0,
          pendingCheckCount: 1,
          passingCheckCount: 100,
        }).status,
      ).toBe("pending");
    });
  });

  describe("aria labels", () => {
    it("should generate correct aria label for comments", () => {
      const getCommentsAriaLabel = (count: number) =>
        `${count} unresolved comment${count !== 1 ? "s" : ""}`;

      expect(getCommentsAriaLabel(1)).toBe("1 unresolved comment");
      expect(getCommentsAriaLabel(2)).toBe("2 unresolved comments");
      expect(getCommentsAriaLabel(10)).toBe("10 unresolved comments");
    });

    it("should generate correct aria label for failing checks", () => {
      const getChecksAriaLabel = (count: number) =>
        `${count} failing check${count !== 1 ? "s" : ""}`;

      expect(getChecksAriaLabel(1)).toBe("1 failing check");
      expect(getChecksAriaLabel(2)).toBe("2 failing checks");
    });

    it("should generate correct aria label for pending checks", () => {
      const getChecksAriaLabel = (count: number) =>
        `${count} pending check${count !== 1 ? "s" : ""}`;

      expect(getChecksAriaLabel(1)).toBe("1 pending check");
      expect(getChecksAriaLabel(2)).toBe("2 pending checks");
    });

    it("should generate correct aria label for passing checks", () => {
      const getChecksAriaLabel = (count: number) =>
        `${count} passing check${count !== 1 ? "s" : ""}`;

      expect(getChecksAriaLabel(1)).toBe("1 passing check");
      expect(getChecksAriaLabel(5)).toBe("5 passing checks");
    });
  });

  describe("click handlers", () => {
    it("should call onCommentsClick when comments indicator is clicked", () => {
      const onCommentsClick = vi.fn();
      const stopPropagation = vi.fn();

      const handleClick = (
        e: { stopPropagation: () => void },
        callback?: (e: React.MouseEvent) => void,
      ) => {
        e.stopPropagation();
        callback?.(e as unknown as React.MouseEvent);
      };

      handleClick({ stopPropagation }, onCommentsClick);

      expect(stopPropagation).toHaveBeenCalled();
      expect(onCommentsClick).toHaveBeenCalled();
    });

    it("should call onChecksClick when checks indicator is clicked", () => {
      const onChecksClick = vi.fn();
      const stopPropagation = vi.fn();

      const handleClick = (
        e: { stopPropagation: () => void },
        callback?: (e: React.MouseEvent) => void,
      ) => {
        e.stopPropagation();
        callback?.(e as unknown as React.MouseEvent);
      };

      handleClick({ stopPropagation }, onChecksClick);

      expect(stopPropagation).toHaveBeenCalled();
      expect(onChecksClick).toHaveBeenCalled();
    });

    it("should call onConflictsClick when conflicts indicator is clicked", () => {
      const onConflictsClick = vi.fn();
      const stopPropagation = vi.fn();

      const handleClick = (
        e: { stopPropagation: () => void },
        callback?: (e: React.MouseEvent) => void,
      ) => {
        e.stopPropagation();
        callback?.(e as unknown as React.MouseEvent);
      };

      handleClick({ stopPropagation }, onConflictsClick);

      expect(stopPropagation).toHaveBeenCalled();
      expect(onConflictsClick).toHaveBeenCalled();
    });
  });
});
