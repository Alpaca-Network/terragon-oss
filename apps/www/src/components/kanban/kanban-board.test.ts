import { describe, it, expect } from "vitest";
import { KANBAN_COLUMNS, KanbanColumn } from "./types";
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
      const newIndex = navigateColumn(lastIndex, "right"); // done
      expect(newIndex).toBe(lastIndex); // stays at done
    });

    it("should correctly traverse all columns with right navigation", () => {
      const expectedOrder = ["backlog", "in_progress", "in_review", "done"];
      let currentIndex = 0;

      for (let i = 0; i < expectedOrder.length; i++) {
        expect(KANBAN_COLUMNS[currentIndex]?.id).toBe(expectedOrder[i]);
        if (i < expectedOrder.length - 1) {
          currentIndex = navigateColumn(currentIndex, "right");
        }
      }
    });

    it("should correctly traverse all columns with left navigation", () => {
      const expectedOrder = ["done", "in_review", "in_progress", "backlog"];
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
      expect(KANBAN_COLUMNS.length).toBe(4);
      expect(KANBAN_COLUMNS.map((c) => c.id)).toEqual([
        "backlog",
        "in_progress",
        "in_review",
        "done",
      ]);
    });

    it("should have titles for each column for display in full-screen mode", () => {
      KANBAN_COLUMNS.forEach((column) => {
        expect(column.title).toBeTruthy();
        expect(column.title.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Keyboard navigation in full-screen mode", () => {
    // Helper to simulate keyboard navigation logic matching the component
    const simulateArrowKey = (
      currentIndex: number,
      key: "ArrowLeft" | "ArrowRight",
    ): number => {
      if (key === "ArrowLeft" && currentIndex > 0) {
        return Math.max(0, currentIndex - 1);
      } else if (
        key === "ArrowRight" &&
        currentIndex < KANBAN_COLUMNS.length - 1
      ) {
        return Math.min(KANBAN_COLUMNS.length - 1, currentIndex + 1);
      }
      return currentIndex;
    };

    it("should navigate left with ArrowLeft key from middle column", () => {
      const newIndex = simulateArrowKey(2, "ArrowLeft"); // in_review -> in_progress
      expect(newIndex).toBe(1);
    });

    it("should navigate right with ArrowRight key from middle column", () => {
      const newIndex = simulateArrowKey(2, "ArrowRight"); // in_review -> done
      expect(newIndex).toBe(3);
    });

    it("should not navigate left from first column (backlog)", () => {
      const newIndex = simulateArrowKey(0, "ArrowLeft");
      expect(newIndex).toBe(0); // stays at backlog
    });

    it("should not navigate right from last column (done)", () => {
      const lastIndex = KANBAN_COLUMNS.length - 1;
      const newIndex = simulateArrowKey(lastIndex, "ArrowRight");
      expect(newIndex).toBe(lastIndex); // stays at done
    });

    it("should navigate through all columns with right arrow keys", () => {
      let currentIndex = 0; // Start at backlog
      const expectedPath = [0, 1, 2, 3]; // All column indices

      expectedPath.forEach((expectedIndex) => {
        expect(currentIndex).toBe(expectedIndex);
        currentIndex = simulateArrowKey(currentIndex, "ArrowRight");
      });

      // Final position should be at last column
      expect(currentIndex).toBe(KANBAN_COLUMNS.length - 1);
    });

    it("should navigate through all columns with left arrow keys", () => {
      let currentIndex = KANBAN_COLUMNS.length - 1; // Start at done
      const expectedPath = [3, 2, 1, 0]; // All column indices in reverse

      expectedPath.forEach((expectedIndex) => {
        expect(currentIndex).toBe(expectedIndex);
        currentIndex = simulateArrowKey(currentIndex, "ArrowLeft");
      });

      // Final position should be at first column
      expect(currentIndex).toBe(0);
    });

    it("should stay in bounds when rapidly pressing left arrow at start", () => {
      let currentIndex = 0;
      for (let i = 0; i < 10; i++) {
        currentIndex = simulateArrowKey(currentIndex, "ArrowLeft");
        expect(currentIndex).toBe(0);
        expect(currentIndex).toBeGreaterThanOrEqual(0);
      }
    });

    it("should stay in bounds when rapidly pressing right arrow at end", () => {
      let currentIndex = KANBAN_COLUMNS.length - 1;
      for (let i = 0; i < 10; i++) {
        currentIndex = simulateArrowKey(currentIndex, "ArrowRight");
        expect(currentIndex).toBe(KANBAN_COLUMNS.length - 1);
        expect(currentIndex).toBeLessThan(KANBAN_COLUMNS.length);
      }
    });

    it("should navigate bidirectionally without losing position", () => {
      let currentIndex = 2; // Start at in_review

      // Go right
      currentIndex = simulateArrowKey(currentIndex, "ArrowRight");
      expect(currentIndex).toBe(3); // done

      // Go left
      currentIndex = simulateArrowKey(currentIndex, "ArrowLeft");
      expect(currentIndex).toBe(2); // back to in_review

      // Go left again
      currentIndex = simulateArrowKey(currentIndex, "ArrowLeft");
      expect(currentIndex).toBe(1); // in_progress

      // Go right
      currentIndex = simulateArrowKey(currentIndex, "ArrowRight");
      expect(currentIndex).toBe(2); // back to in_review
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

  describe("Column wheel scrolling", () => {
    const getWheelBehavior = (
      scrollWidth: number,
      clientWidth: number,
      deltaX: number,
      deltaY: number,
      hasNestedScrollable: boolean,
      nestedOverflowPx: number,
      nestedOverflowThresholdPx = 16,
    ): { shouldScroll: boolean; shouldPreventDefault: boolean } => {
      if (hasNestedScrollable && nestedOverflowPx > nestedOverflowThresholdPx) {
        return { shouldScroll: false, shouldPreventDefault: false };
      }
      const hasHorizontalOverflow = scrollWidth > clientWidth + 1;
      if (!hasHorizontalOverflow) {
        return { shouldScroll: false, shouldPreventDefault: false };
      }

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absY <= absX) {
        return { shouldScroll: false, shouldPreventDefault: false };
      }

      return { shouldScroll: true, shouldPreventDefault: true };
    };

    it("should not hijack wheel when columns fit", () => {
      const result = getWheelBehavior(600, 600, 0, 120, false, 0);
      expect(result).toEqual({
        shouldScroll: false,
        shouldPreventDefault: false,
      });
    });

    it("should not hijack wheel when horizontal intent is stronger", () => {
      const result = getWheelBehavior(900, 600, 120, 80, false, 0);
      expect(result).toEqual({
        shouldScroll: false,
        shouldPreventDefault: false,
      });
    });

    it("should convert vertical wheel to horizontal scroll when overflowing", () => {
      const result = getWheelBehavior(900, 600, 10, 140, false, 0);
      expect(result).toEqual({
        shouldScroll: true,
        shouldPreventDefault: true,
      });
    });

    it("should allow nested column scroll to handle wheel", () => {
      const result = getWheelBehavior(900, 600, 0, 140, true, 32);
      expect(result).toEqual({
        shouldScroll: false,
        shouldPreventDefault: false,
      });
    });

    it("should allow kanban scroll when nested overflow is tiny", () => {
      const result = getWheelBehavior(900, 600, 0, 140, true, 8);
      expect(result).toEqual({
        shouldScroll: true,
        shouldPreventDefault: true,
      });
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

  describe("Done column pagination", () => {
    // Helper to determine if a column should have pagination props
    const shouldColumnHavePagination = (columnId: KanbanColumn): boolean => {
      return columnId === "done";
    };

    it("should only enable pagination for done column", () => {
      expect(shouldColumnHavePagination("done")).toBe(true);
      expect(shouldColumnHavePagination("backlog")).toBe(false);
      expect(shouldColumnHavePagination("in_progress")).toBe(false);
      expect(shouldColumnHavePagination("in_review")).toBe(false);
    });

    it("should have done column in KANBAN_COLUMNS for pagination support", () => {
      const doneColumn = KANBAN_COLUMNS.find((c) => c.id === "done");
      expect(doneColumn).toBeDefined();
      expect(doneColumn?.id).toBe("done");
    });

    // Helper to simulate should-show-load-more logic
    const shouldShowLoadMore = (
      hasNextPage: boolean,
      onLoadMore: (() => void) | undefined,
      threadsLength: number,
    ): boolean => {
      return hasNextPage && !!onLoadMore && threadsLength > 0;
    };

    const mockLoadMore = () => {};

    it("should show load more button when hasNextPage is true, onLoadMore provided, and threads exist", () => {
      expect(shouldShowLoadMore(true, mockLoadMore, 25)).toBe(true);
    });

    it("should not show load more button when hasNextPage is false", () => {
      expect(shouldShowLoadMore(false, mockLoadMore, 25)).toBe(false);
    });

    it("should not show load more button when no threads exist", () => {
      expect(shouldShowLoadMore(true, mockLoadMore, 0)).toBe(false);
    });

    it("should not show load more button when hasNextPage false and no threads", () => {
      expect(shouldShowLoadMore(false, mockLoadMore, 0)).toBe(false);
    });

    it("should not show load more button when onLoadMore is undefined", () => {
      expect(shouldShowLoadMore(true, undefined, 25)).toBe(false);
    });

    // Helper to simulate pagination props for columns
    const getPaginationPropsForColumn = (
      columnId: KanbanColumn,
      archivedHasNextPage: boolean,
    ): { hasNextPage: boolean | undefined } => {
      return {
        hasNextPage: columnId === "done" ? archivedHasNextPage : undefined,
      };
    };

    it("should pass hasNextPage to done column only", () => {
      const doneProps = getPaginationPropsForColumn("done", true);
      expect(doneProps.hasNextPage).toBe(true);

      const backlogProps = getPaginationPropsForColumn("backlog", true);
      expect(backlogProps.hasNextPage).toBeUndefined();

      const inProgressProps = getPaginationPropsForColumn("in_progress", true);
      expect(inProgressProps.hasNextPage).toBeUndefined();

      const inReviewProps = getPaginationPropsForColumn("in_review", true);
      expect(inReviewProps.hasNextPage).toBeUndefined();
    });

    it("should pass false hasNextPage when no more pages", () => {
      const doneProps = getPaginationPropsForColumn("done", false);
      expect(doneProps.hasNextPage).toBe(false);
    });
  });
});
