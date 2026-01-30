import { describe, it, expect } from "vitest";

/**
 * Tests for the PRFeedbackIndicators component logic.
 *
 * The component displays indicators for PR checks status (failing/pending/passing)
 * and PR comments (unresolved/resolved) with appropriate colors and click handlers.
 */
describe("PRFeedbackIndicators component logic", () => {
  describe("rendering conditions", () => {
    it("should not render when hasPR is false", () => {
      const shouldRender = (hasPR: boolean) => hasPR;
      expect(shouldRender(false)).toBe(false);
    });

    it("should be eligible to render when hasPR is true", () => {
      const shouldRender = (hasPR: boolean) => hasPR;
      expect(shouldRender(true)).toBe(true);
    });
  });

  describe("checks indicator status determination", () => {
    type CheckStatus = "failing" | "pending" | "passing";

    const getCheckStatus = (
      failingCount: number,
      pendingCount: number,
      _passingCount: number,
    ): CheckStatus => {
      if (failingCount > 0) return "failing";
      if (pendingCount > 0) return "pending";
      return "passing";
    };

    it("should show failing status when there are failing checks", () => {
      expect(getCheckStatus(1, 0, 5)).toBe("failing");
      expect(getCheckStatus(3, 2, 5)).toBe("failing"); // failing takes priority
      expect(getCheckStatus(1, 5, 10)).toBe("failing"); // failing takes priority over pending
    });

    it("should show pending status when there are pending checks but no failing", () => {
      expect(getCheckStatus(0, 1, 5)).toBe("pending");
      expect(getCheckStatus(0, 5, 10)).toBe("pending");
    });

    it("should show passing status when all checks pass", () => {
      expect(getCheckStatus(0, 0, 5)).toBe("passing");
      expect(getCheckStatus(0, 0, 1)).toBe("passing");
    });
  });

  describe("checks indicator visibility", () => {
    it("should not show checks indicator when total count is 0", () => {
      const shouldShowChecks = (
        failingCount: number,
        pendingCount: number,
        passingCount: number,
      ) => {
        const totalCount = failingCount + pendingCount + passingCount;
        return totalCount > 0;
      };

      expect(shouldShowChecks(0, 0, 0)).toBe(false);
    });

    it("should show checks indicator when there are any checks", () => {
      const shouldShowChecks = (
        failingCount: number,
        pendingCount: number,
        passingCount: number,
      ) => {
        const totalCount = failingCount + pendingCount + passingCount;
        return totalCount > 0;
      };

      expect(shouldShowChecks(1, 0, 0)).toBe(true);
      expect(shouldShowChecks(0, 1, 0)).toBe(true);
      expect(shouldShowChecks(0, 0, 1)).toBe(true);
      expect(shouldShowChecks(2, 3, 5)).toBe(true);
    });
  });

  describe("checks tooltip text generation", () => {
    const getChecksTooltipText = (
      failingCount: number,
      pendingCount: number,
      passingCount: number,
    ): string => {
      if (failingCount > 0) {
        return `${failingCount} failing check${failingCount !== 1 ? "s" : ""}`;
      }
      if (pendingCount > 0) {
        return `${pendingCount} pending check${pendingCount !== 1 ? "s" : ""}`;
      }
      return `${passingCount} passing check${passingCount !== 1 ? "s" : ""}`;
    };

    it("should use singular form for 1 failing check", () => {
      expect(getChecksTooltipText(1, 0, 0)).toBe("1 failing check");
    });

    it("should use plural form for multiple failing checks", () => {
      expect(getChecksTooltipText(3, 0, 0)).toBe("3 failing checks");
    });

    it("should use singular form for 1 pending check", () => {
      expect(getChecksTooltipText(0, 1, 0)).toBe("1 pending check");
    });

    it("should use plural form for multiple pending checks", () => {
      expect(getChecksTooltipText(0, 5, 0)).toBe("5 pending checks");
    });

    it("should use singular form for 1 passing check", () => {
      expect(getChecksTooltipText(0, 0, 1)).toBe("1 passing check");
    });

    it("should use plural form for multiple passing checks", () => {
      expect(getChecksTooltipText(0, 0, 10)).toBe("10 passing checks");
    });
  });

  describe("comments indicator visibility", () => {
    it("should not show comments indicator when total count is 0", () => {
      const shouldShowComments = (
        unresolvedCount: number,
        resolvedCount: number,
      ) => {
        const totalCount = unresolvedCount + resolvedCount;
        return totalCount > 0;
      };

      expect(shouldShowComments(0, 0)).toBe(false);
    });

    it("should show comments indicator when there are any comments", () => {
      const shouldShowComments = (
        unresolvedCount: number,
        resolvedCount: number,
      ) => {
        const totalCount = unresolvedCount + resolvedCount;
        return totalCount > 0;
      };

      expect(shouldShowComments(1, 0)).toBe(true);
      expect(shouldShowComments(0, 1)).toBe(true);
      expect(shouldShowComments(3, 5)).toBe(true);
    });
  });

  describe("comments indicator color determination", () => {
    type CommentStatus = "unresolved" | "resolved";

    const getCommentStatus = (
      unresolvedCount: number,
      _resolvedCount: number,
    ): CommentStatus => {
      if (unresolvedCount > 0) return "unresolved";
      return "resolved";
    };

    it("should show unresolved status when there are unresolved comments", () => {
      expect(getCommentStatus(1, 0)).toBe("unresolved");
      expect(getCommentStatus(5, 3)).toBe("unresolved"); // unresolved takes priority
    });

    it("should show resolved status when all comments are resolved", () => {
      expect(getCommentStatus(0, 5)).toBe("resolved");
      expect(getCommentStatus(0, 1)).toBe("resolved");
    });
  });

  describe("comments tooltip text generation", () => {
    const getCommentsTooltipText = (
      unresolvedCount: number,
      resolvedCount: number,
    ): string => {
      if (unresolvedCount > 0) {
        let text = `${unresolvedCount} unresolved comment${unresolvedCount !== 1 ? "s" : ""}`;
        if (resolvedCount > 0) {
          text += `, ${resolvedCount} resolved`;
        }
        return text;
      }
      return `${resolvedCount} resolved comment${resolvedCount !== 1 ? "s" : ""}`;
    };

    it("should use singular form for 1 unresolved comment", () => {
      expect(getCommentsTooltipText(1, 0)).toBe("1 unresolved comment");
    });

    it("should use plural form for multiple unresolved comments", () => {
      expect(getCommentsTooltipText(3, 0)).toBe("3 unresolved comments");
    });

    it("should include resolved count when there are both unresolved and resolved", () => {
      expect(getCommentsTooltipText(2, 3)).toBe(
        "2 unresolved comments, 3 resolved",
      );
      expect(getCommentsTooltipText(1, 5)).toBe(
        "1 unresolved comment, 5 resolved",
      );
    });

    it("should use singular form for 1 resolved comment (when no unresolved)", () => {
      expect(getCommentsTooltipText(0, 1)).toBe("1 resolved comment");
    });

    it("should use plural form for multiple resolved comments (when no unresolved)", () => {
      expect(getCommentsTooltipText(0, 5)).toBe("5 resolved comments");
    });
  });

  describe("displayed count logic", () => {
    describe("checks indicator displayed count", () => {
      const getChecksDisplayCount = (
        failingCount: number,
        pendingCount: number,
        _passingCount: number,
      ): number | null => {
        if (failingCount > 0) return failingCount;
        if (pendingCount > 0) return pendingCount;
        return null; // Don't show count for passing (only show icon)
      };

      it("should display failing count when there are failing checks", () => {
        expect(getChecksDisplayCount(3, 2, 5)).toBe(3);
      });

      it("should display pending count when there are pending but no failing checks", () => {
        expect(getChecksDisplayCount(0, 4, 5)).toBe(4);
      });

      it("should not display count when all checks are passing", () => {
        expect(getChecksDisplayCount(0, 0, 10)).toBeNull();
      });
    });

    describe("comments indicator displayed count", () => {
      const getCommentsDisplayCount = (
        unresolvedCount: number,
        resolvedCount: number,
      ): number => {
        if (unresolvedCount > 0) return unresolvedCount;
        return resolvedCount;
      };

      it("should display unresolved count when there are unresolved comments", () => {
        expect(getCommentsDisplayCount(5, 3)).toBe(5);
      });

      it("should display resolved count when all comments are resolved", () => {
        expect(getCommentsDisplayCount(0, 8)).toBe(8);
      });
    });
  });
});
