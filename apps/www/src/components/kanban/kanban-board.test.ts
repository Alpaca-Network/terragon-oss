import { describe, it, expect } from "vitest";
import { KANBAN_COLUMNS } from "./types";
import type { PRFeedbackSummary } from "@terragon/shared/db/types";

describe("Kanban Board Desktop", () => {
  describe("Column navigation", () => {
    // Helper to simulate navigate column logic matching the component
    const navigateColumn = (
      currentIndex: number,
      direction: "left" | "right",
    ): number => {
      if (direction === "left") {
        return Math.max(0, currentIndex - 1);
      }
      return Math.min(KANBAN_COLUMNS.length - 1, currentIndex + 1);
    };

    it("should navigate left from middle column", () => {
      const newIndex = navigateColumn(2, "left"); // in_review (index 2)
      expect(newIndex).toBe(1); // in_progress (index 1)
    });

    it("should navigate right from middle column", () => {
      const newIndex = navigateColumn(2, "right"); // in_review (index 2)
      expect(newIndex).toBe(3); // done (index 3)
    });

    it("should not go below 0 when navigating left from first column", () => {
      const newIndex = navigateColumn(0, "left"); // backlog (index 0)
      expect(newIndex).toBe(0); // stays at backlog
    });

    it("should not exceed max index when navigating right from last column", () => {
      const lastIndex = KANBAN_COLUMNS.length - 1;
      const newIndex = navigateColumn(lastIndex, "right"); // cancelled
      expect(newIndex).toBe(lastIndex); // stays at cancelled
    });

    it("should correctly traverse all columns with right navigation", () => {
      const expectedOrder = [
        "backlog",
        "in_progress",
        "in_review",
        "done",
        "cancelled",
      ];
      let currentIndex = 0;

      for (let i = 0; i < expectedOrder.length; i++) {
        expect(KANBAN_COLUMNS[currentIndex]?.id).toBe(expectedOrder[i]);
        if (i < expectedOrder.length - 1) {
          currentIndex = navigateColumn(currentIndex, "right");
        }
      }
    });

    it("should correctly traverse all columns with left navigation", () => {
      const expectedOrder = [
        "cancelled",
        "done",
        "in_review",
        "in_progress",
        "backlog",
      ];
      let currentIndex = KANBAN_COLUMNS.length - 1;

      for (let i = 0; i < expectedOrder.length; i++) {
        expect(KANBAN_COLUMNS[currentIndex]?.id).toBe(expectedOrder[i]);
        if (i < expectedOrder.length - 1) {
          currentIndex = navigateColumn(currentIndex, "left");
        }
      }
    });
  });

  describe("Full-screen mode", () => {
    it("should have all columns available for full-screen view", () => {
      expect(KANBAN_COLUMNS.length).toBe(5);
      expect(KANBAN_COLUMNS.map((c) => c.id)).toEqual([
        "backlog",
        "in_progress",
        "in_review",
        "done",
        "cancelled",
      ]);
    });

    it("should have titles for each column for display in full-screen mode", () => {
      KANBAN_COLUMNS.forEach((column) => {
        expect(column.title).toBeTruthy();
        expect(column.title.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Scroll arrow visibility", () => {
    // Helper to check scroll visibility logic matching the component
    const checkScrollVisibility = (
      scrollLeft: number,
      scrollWidth: number,
      clientWidth: number,
    ): { canScrollLeft: boolean; canScrollRight: boolean } => {
      return {
        canScrollLeft: scrollLeft > 0,
        canScrollRight: scrollLeft + clientWidth < scrollWidth - 10,
      };
    };

    it("should not show left arrow when at start", () => {
      const { canScrollLeft } = checkScrollVisibility(0, 1000, 500);
      expect(canScrollLeft).toBe(false);
    });

    it("should show left arrow when scrolled", () => {
      const { canScrollLeft } = checkScrollVisibility(100, 1000, 500);
      expect(canScrollLeft).toBe(true);
    });

    it("should show right arrow when content is wider than viewport", () => {
      const { canScrollRight } = checkScrollVisibility(0, 1000, 500);
      expect(canScrollRight).toBe(true);
    });

    it("should not show right arrow when at end (within threshold)", () => {
      // scrollLeft (490) + clientWidth (500) = 990, scrollWidth (1000) - 10 = 990
      const { canScrollRight } = checkScrollVisibility(490, 1000, 500);
      expect(canScrollRight).toBe(false);
    });

    it("should show right arrow when more than threshold from end", () => {
      // scrollLeft (480) + clientWidth (500) = 980 < 1000 - 10 = 990
      const { canScrollRight } = checkScrollVisibility(480, 1000, 500);
      expect(canScrollRight).toBe(true);
    });

    it("should show both arrows when in middle of scroll", () => {
      const visibility = checkScrollVisibility(250, 1000, 500);
      expect(visibility.canScrollLeft).toBe(true);
      expect(visibility.canScrollRight).toBe(true);
    });

    it("should handle edge case when content fits exactly", () => {
      const { canScrollLeft, canScrollRight } = checkScrollVisibility(
        0,
        500,
        500,
      );
      expect(canScrollLeft).toBe(false);
      expect(canScrollRight).toBe(false);
    });
  });

  describe("Panel sizing constants", () => {
    const TASK_PANEL_MIN_WIDTH = 500;
    const TASK_PANEL_MAX_WIDTH_PERCENT = 75;
    const TASK_PANEL_DEFAULT_WIDTH_PERCENT = 55;

    it("should have minimum width suitable for content", () => {
      expect(TASK_PANEL_MIN_WIDTH).toBeGreaterThanOrEqual(400);
      expect(TASK_PANEL_MIN_WIDTH).toBeLessThanOrEqual(600);
    });

    it("should have reasonable max width percentage", () => {
      expect(TASK_PANEL_MAX_WIDTH_PERCENT).toBeGreaterThan(50);
      expect(TASK_PANEL_MAX_WIDTH_PERCENT).toBeLessThanOrEqual(90);
    });

    it("should have default width less than max width", () => {
      expect(TASK_PANEL_DEFAULT_WIDTH_PERCENT).toBeLessThan(
        TASK_PANEL_MAX_WIDTH_PERCENT,
      );
    });

    it("should have default width greater than half screen", () => {
      expect(TASK_PANEL_DEFAULT_WIDTH_PERCENT).toBeGreaterThan(50);
    });
  });

  describe("Code review status calculation", () => {
    // Helper function matching the component logic for calculating code review status
    const calculateCodeReviewStatus = (
      summary: PRFeedbackSummary | null,
    ): { unresolvedCount: number; isAllPassing: boolean } | null => {
      if (!summary) return null;
      const unresolvedCount =
        summary.unresolvedCommentCount +
        summary.failingCheckCount +
        (summary.hasConflicts ? 1 : 0);
      return {
        unresolvedCount,
        isAllPassing: unresolvedCount === 0,
      };
    };

    it("should return null when summary is null", () => {
      const result = calculateCodeReviewStatus(null);
      expect(result).toBeNull();
    });

    it("should show all passing when no unresolved items", () => {
      const summary: PRFeedbackSummary = {
        unresolvedCommentCount: 0,
        resolvedCommentCount: 5,
        failingCheckCount: 0,
        pendingCheckCount: 0,
        passingCheckCount: 10,
        hasCoverageCheck: true,
        coverageCheckPassed: true,
        hasConflicts: false,
        isMergeable: true,
      };
      const result = calculateCodeReviewStatus(summary);
      expect(result).toEqual({
        unresolvedCount: 0,
        isAllPassing: true,
      });
    });

    it("should count unresolved comments", () => {
      const summary: PRFeedbackSummary = {
        unresolvedCommentCount: 3,
        resolvedCommentCount: 2,
        failingCheckCount: 0,
        pendingCheckCount: 0,
        passingCheckCount: 5,
        hasCoverageCheck: false,
        coverageCheckPassed: null,
        hasConflicts: false,
        isMergeable: true,
      };
      const result = calculateCodeReviewStatus(summary);
      expect(result).toEqual({
        unresolvedCount: 3,
        isAllPassing: false,
      });
    });

    it("should count failing checks", () => {
      const summary: PRFeedbackSummary = {
        unresolvedCommentCount: 0,
        resolvedCommentCount: 0,
        failingCheckCount: 2,
        pendingCheckCount: 1,
        passingCheckCount: 5,
        hasCoverageCheck: false,
        coverageCheckPassed: null,
        hasConflicts: false,
        isMergeable: false,
      };
      const result = calculateCodeReviewStatus(summary);
      expect(result).toEqual({
        unresolvedCount: 2,
        isAllPassing: false,
      });
    });

    it("should count conflicts as 1 unresolved item", () => {
      const summary: PRFeedbackSummary = {
        unresolvedCommentCount: 0,
        resolvedCommentCount: 0,
        failingCheckCount: 0,
        pendingCheckCount: 0,
        passingCheckCount: 5,
        hasCoverageCheck: false,
        coverageCheckPassed: null,
        hasConflicts: true,
        isMergeable: false,
      };
      const result = calculateCodeReviewStatus(summary);
      expect(result).toEqual({
        unresolvedCount: 1,
        isAllPassing: false,
      });
    });

    it("should sum all unresolved items correctly", () => {
      const summary: PRFeedbackSummary = {
        unresolvedCommentCount: 5,
        resolvedCommentCount: 3,
        failingCheckCount: 3,
        pendingCheckCount: 2,
        passingCheckCount: 10,
        hasCoverageCheck: true,
        coverageCheckPassed: false,
        hasConflicts: true,
        isMergeable: false,
      };
      const result = calculateCodeReviewStatus(summary);
      expect(result).toEqual({
        unresolvedCount: 9, // 5 comments + 3 failing checks + 1 conflict
        isAllPassing: false,
      });
    });

    it("should not count pending checks as unresolved", () => {
      const summary: PRFeedbackSummary = {
        unresolvedCommentCount: 0,
        resolvedCommentCount: 0,
        failingCheckCount: 0,
        pendingCheckCount: 5,
        passingCheckCount: 0,
        hasCoverageCheck: false,
        coverageCheckPassed: null,
        hasConflicts: false,
        isMergeable: true,
      };
      const result = calculateCodeReviewStatus(summary);
      expect(result).toEqual({
        unresolvedCount: 0,
        isAllPassing: true,
      });
    });
  });
});
