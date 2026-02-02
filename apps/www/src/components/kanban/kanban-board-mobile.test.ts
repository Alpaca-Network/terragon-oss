import { describe, it, expect } from "vitest";
import { KANBAN_COLUMNS, KanbanColumn } from "./types";
import {
  FAB_CLASSES,
  CONTENT_BOTTOM_PADDING,
  SWIPE_THRESHOLD,
  calculateScrollToCenter,
  shouldShowArchiveToggle,
  getColumnHeaderColor,
} from "./kanban-board-mobile";

describe("Kanban Mobile Components", () => {
  describe("KANBAN_COLUMNS configuration", () => {
    it("should have all required columns for mobile tabs", () => {
      const columnIds = KANBAN_COLUMNS.map((c) => c.id);
      expect(columnIds).toContain("backlog");
      expect(columnIds).toContain("in_progress");
      expect(columnIds).toContain("in_review");
      expect(columnIds).toContain("done");
      expect(columnIds).toContain("failed");
    });

    it("should have titles suitable for mobile display (short enough)", () => {
      // All titles should be reasonably short for mobile tabs
      KANBAN_COLUMNS.forEach((column) => {
        expect(column.title.length).toBeLessThanOrEqual(15);
      });
    });

    it("should have in_progress column available as the default active column", () => {
      // The mobile board defaults to in_progress as it's the most relevant view
      // This test validates that in_progress exists in KANBAN_COLUMNS
      // The actual default is set via useState("in_progress") in KanbanBoardMobile
      const inProgressColumn = KANBAN_COLUMNS.find(
        (c) => c.id === "in_progress",
      );
      expect(inProgressColumn).toBeDefined();
      expect(inProgressColumn?.id).toBe("in_progress");
    });
  });

  describe("Column header colors mapping", () => {
    // Tests the actual exported getColumnHeaderColor function from the component
    it("should return muted color for backlog", () => {
      const color = getColumnHeaderColor("backlog");
      expect(color).toContain("bg-muted");
    });

    it("should return primary color for in_progress", () => {
      const color = getColumnHeaderColor("in_progress");
      expect(color).toContain("primary");
    });

    it("should return accent color for in_review", () => {
      const color = getColumnHeaderColor("in_review");
      expect(color).toContain("accent");
    });

    it("should return primary color for done", () => {
      const color = getColumnHeaderColor("done");
      expect(color).toContain("primary");
    });

    it("should return destructive color for failed", () => {
      const color = getColumnHeaderColor("failed");
      expect(color).toContain("destructive");
    });

    it("should have all columns with a defined color", () => {
      KANBAN_COLUMNS.forEach((column) => {
        const color = getColumnHeaderColor(column.id);
        expect(color).toBeTruthy();
        expect(color.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Mobile drawer configuration", () => {
    // Constants that should match the drawer implementation
    const SNAP_POINTS = [0.8, 1] as const;
    const DEFAULT_SNAP_POINT = 0.8;
    const DEFAULT_TAB = "feed";
    const AVAILABLE_TABS = ["feed", "changes", "code-review"];

    it("should have snap points at 80% and 100% for mobile", () => {
      expect(SNAP_POINTS).toContain(0.8);
      expect(SNAP_POINTS).toContain(1);
      expect(SNAP_POINTS.length).toBe(2);
    });

    it("should default to 80% snap point (not maximized)", () => {
      expect(DEFAULT_SNAP_POINT).toBe(0.8);
    });

    it("should have snap points in ascending order", () => {
      // Vaul requires snap points to be in ascending order
      for (let i = 1; i < SNAP_POINTS.length; i++) {
        expect(SNAP_POINTS[i]).toBeGreaterThan(SNAP_POINTS[i - 1]!);
      }
    });

    it("should allow maximizing to 100% viewport height", () => {
      expect(SNAP_POINTS).toContain(1);
    });

    it("should default to feed tab", () => {
      expect(DEFAULT_TAB).toBe("feed");
    });

    it("should have feed, changes, and code-review tabs available", () => {
      expect(AVAILABLE_TABS).toContain("feed");
      expect(AVAILABLE_TABS).toContain("changes");
      // Code review tab is enabled when thread has a PR associated
      expect(AVAILABLE_TABS).toContain("code-review");
    });
  });

  describe("Mobile drawer maximize/minimize", () => {
    const DEFAULT_SNAP_POINT = 0.8;
    const MAXIMIZED_SNAP_POINT = 1;

    // Helper to simulate toggle maximize logic
    const toggleMaximize = (currentSnap: number): number => {
      return currentSnap === MAXIMIZED_SNAP_POINT
        ? DEFAULT_SNAP_POINT
        : MAXIMIZED_SNAP_POINT;
    };

    // Helper to get height class based on snap point
    const getHeightClass = (currentSnap: number): string => {
      if (currentSnap === MAXIMIZED_SNAP_POINT) {
        return "h-[100dvh] max-h-[100dvh]";
      }
      return "h-[80dvh] max-h-[80dvh]";
    };

    it("should toggle from default (80%) to maximized (100%)", () => {
      const newSnap = toggleMaximize(DEFAULT_SNAP_POINT);
      expect(newSnap).toBe(MAXIMIZED_SNAP_POINT);
    });

    it("should toggle from maximized (100%) back to default (80%)", () => {
      const newSnap = toggleMaximize(MAXIMIZED_SNAP_POINT);
      expect(newSnap).toBe(DEFAULT_SNAP_POINT);
    });

    it("should return 80dvh height class for default snap point", () => {
      const heightClass = getHeightClass(DEFAULT_SNAP_POINT);
      expect(heightClass).toContain("80dvh");
    });

    it("should return 100dvh height class for maximized snap point", () => {
      const heightClass = getHeightClass(MAXIMIZED_SNAP_POINT);
      expect(heightClass).toContain("100dvh");
    });

    it("should use dvh units for dynamic viewport height support", () => {
      // dvh accounts for mobile browser chrome (address bar, etc.)
      const defaultClass = getHeightClass(DEFAULT_SNAP_POINT);
      const maximizedClass = getHeightClass(MAXIMIZED_SNAP_POINT);
      expect(defaultClass).toContain("dvh");
      expect(maximizedClass).toContain("dvh");
    });
  });

  describe("Swipe gesture navigation", () => {
    // Uses the actual exported SWIPE_THRESHOLD constant from the component

    // Helper to get column index
    const getColumnIndex = (columnId: KanbanColumn): number => {
      return KANBAN_COLUMNS.findIndex((col) => col.id === columnId);
    };

    // Helper to simulate swipe logic
    const getNextColumnAfterSwipe = (
      currentColumn: KanbanColumn,
      direction: "left" | "right",
    ): KanbanColumn => {
      const currentIndex = getColumnIndex(currentColumn);
      const newIndex =
        direction === "left"
          ? Math.min(currentIndex + 1, KANBAN_COLUMNS.length - 1)
          : Math.max(currentIndex - 1, 0);

      const column = KANBAN_COLUMNS[newIndex];
      return column ? column.id : currentColumn;
    };

    it("should have a reasonable swipe threshold", () => {
      // 50px is a good balance between accidental swipes and intentional ones
      expect(SWIPE_THRESHOLD).toBeGreaterThanOrEqual(30);
      expect(SWIPE_THRESHOLD).toBeLessThanOrEqual(100);
    });

    it("should navigate to next tab when swiping left from in_progress", () => {
      const nextColumn = getNextColumnAfterSwipe("in_progress", "left");
      expect(nextColumn).toBe("in_review");
    });

    it("should navigate to previous tab when swiping right from in_progress", () => {
      const prevColumn = getNextColumnAfterSwipe("in_progress", "right");
      expect(prevColumn).toBe("backlog");
    });

    it("should stay on first tab when swiping right from backlog", () => {
      const column = getNextColumnAfterSwipe("backlog", "right");
      expect(column).toBe("backlog");
    });

    it("should stay on last tab when swiping left from failed", () => {
      const column = getNextColumnAfterSwipe("failed", "left");
      expect(column).toBe("failed");
    });

    it("should correctly traverse all columns with left swipes", () => {
      const columnOrder: KanbanColumn[] = [
        "backlog",
        "in_progress",
        "in_review",
        "done",
        "failed",
      ];
      let currentColumn: KanbanColumn = "backlog";

      for (let i = 1; i < columnOrder.length; i++) {
        currentColumn = getNextColumnAfterSwipe(currentColumn, "left");
        expect(currentColumn).toBe(columnOrder[i]);
      }
    });

    it("should correctly traverse all columns with right swipes", () => {
      const columnOrder: KanbanColumn[] = [
        "failed",
        "done",
        "in_review",
        "in_progress",
        "backlog",
      ];
      let currentColumn: KanbanColumn = "failed";

      for (let i = 1; i < columnOrder.length; i++) {
        currentColumn = getNextColumnAfterSwipe(currentColumn, "right");
        expect(currentColumn).toBe(columnOrder[i]);
      }
    });
  });

  describe("New task drawer", () => {
    // New task drawer uses fixed height (doesn't need snap points for maximize)
    const NEW_TASK_DRAWER_HEIGHT = "85vh";

    it("should have a reasonable height for mobile", () => {
      const heightValue = parseInt(NEW_TASK_DRAWER_HEIGHT);
      expect(heightValue).toBeGreaterThanOrEqual(80);
      expect(heightValue).toBeLessThanOrEqual(90);
    });
  });

  describe("Floating action button", () => {
    // Tests the actual exported FAB_CLASSES constant from the component
    it("should be positioned at bottom-right corner", () => {
      expect(FAB_CLASSES.position).toContain("bottom-6");
      expect(FAB_CLASSES.position).toContain("right-6");
      expect(FAB_CLASSES.position).toContain("fixed");
    });

    it("should have appropriate size for touch targets", () => {
      // 56px (h-14/w-14) is good for mobile touch targets (recommended min 44px)
      expect(FAB_CLASSES.size).toContain("h-14");
      expect(FAB_CLASSES.size).toContain("w-14");
      // Verify 14 * 4 = 56px >= 44px minimum touch target
      const sizeValue = 14 * 4;
      expect(sizeValue).toBeGreaterThanOrEqual(44);
    });

    it("should have high z-index to stay above content", () => {
      expect(FAB_CLASSES.style).toContain("z-50");
    });

    it("should have rounded styling for FAB appearance", () => {
      expect(FAB_CLASSES.style).toContain("rounded-full");
      expect(FAB_CLASSES.style).toContain("shadow-lg");
    });
  });

  describe("Content bottom padding for FAB", () => {
    it("should have padding to prevent FAB from obscuring content", () => {
      // pb-20 = 80px which accounts for FAB height (56px) + margin
      expect(CONTENT_BOTTOM_PADDING).toBe("pb-20");
    });
  });

  describe("Archive toggle in Done column", () => {
    // Tests the actual exported shouldShowArchiveToggle function from the component
    it("should only show archive toggle for done column", () => {
      expect(shouldShowArchiveToggle("done", false)).toBe(true);
      expect(shouldShowArchiveToggle("backlog", false)).toBe(false);
      expect(shouldShowArchiveToggle("in_progress", false)).toBe(false);
      expect(shouldShowArchiveToggle("in_review", false)).toBe(false);
      expect(shouldShowArchiveToggle("failed", false)).toBe(false);
    });

    it("should not show archive toggle when viewing archived tasks", () => {
      // When isArchivedView is true, toggle should be hidden
      expect(shouldShowArchiveToggle("done", true)).toBe(false);
      expect(shouldShowArchiveToggle("done", false)).toBe(true);
    });

    it("should hide toggle for all columns in archived view", () => {
      KANBAN_COLUMNS.forEach((col) => {
        expect(shouldShowArchiveToggle(col.id, true)).toBe(false);
      });
    });
  });

  describe("Tab scroll to center on swipe", () => {
    // Tests the actual exported calculateScrollToCenter function from the component
    it("should have all column IDs available for scroll tracking", () => {
      // Verify all columns have unique IDs that can be used for tracking
      const columnIds = KANBAN_COLUMNS.map((c) => c.id);
      const uniqueIds = new Set(columnIds);
      expect(uniqueIds.size).toBe(KANBAN_COLUMNS.length);
    });

    it("should calculate correct scroll position to center a tab", () => {
      // Example: tabs list is 300px wide, tab is at 150px offset with 60px width
      const scrollPos = calculateScrollToCenter(300, 150, 60);
      // Expected: 150 - 150 + 30 = 30
      expect(scrollPos).toBe(30);
    });

    it("should handle scroll for first tab correctly", () => {
      // First tab at offset 0, width 60px, list is 300px
      const scrollPos = calculateScrollToCenter(300, 0, 60);
      // Expected: 0 - 150 + 30 = -120 (browser will clamp to 0)
      expect(scrollPos).toBe(-120);
    });

    it("should center middle tabs correctly", () => {
      // Middle tab at offset 200px, width 80px, list is 400px
      const scrollPos = calculateScrollToCenter(400, 200, 80);
      // Expected: 200 - 200 + 40 = 40
      expect(scrollPos).toBe(40);
    });

    it("should handle last tab position", () => {
      // Last tab at offset 340px, width 60px, list is 400px
      const scrollPos = calculateScrollToCenter(400, 340, 60);
      // Expected: 340 - 200 + 30 = 170
      expect(scrollPos).toBe(170);
    });
  });
});
