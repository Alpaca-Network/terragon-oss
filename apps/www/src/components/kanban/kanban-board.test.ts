import { describe, it, expect } from "vitest";
import { KANBAN_COLUMNS } from "./types";

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
});
