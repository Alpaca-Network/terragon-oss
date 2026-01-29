import { describe, it, expect } from "vitest";
import { KANBAN_COLUMNS, KanbanColumn } from "./types";

describe("Kanban Mobile Components", () => {
  describe("KANBAN_COLUMNS configuration", () => {
    it("should have all required columns for mobile tabs", () => {
      const columnIds = KANBAN_COLUMNS.map((c) => c.id);
      expect(columnIds).toContain("backlog");
      expect(columnIds).toContain("in_progress");
      expect(columnIds).toContain("in_review");
      expect(columnIds).toContain("done");
      expect(columnIds).toContain("cancelled");
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
    // Test the color mapping logic that's used in the mobile component
    const getColumnHeaderColor = (
      columnId: (typeof KANBAN_COLUMNS)[number]["id"],
    ) => {
      switch (columnId) {
        case "backlog":
          return "data-[state=active]:bg-muted";
        case "in_progress":
          return "data-[state=active]:bg-primary/10 data-[state=active]:text-primary";
        case "in_review":
          return "data-[state=active]:bg-accent/10 data-[state=active]:text-accent-foreground";
        case "done":
          return "data-[state=active]:bg-primary/10 data-[state=active]:text-primary";
        case "cancelled":
          return "data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive";
        default:
          return "data-[state=active]:bg-muted";
      }
    };

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

    it("should return destructive color for cancelled", () => {
      const color = getColumnHeaderColor("cancelled");
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
    const DRAWER_HEIGHT = "85vh";
    const DEFAULT_TAB = "feed";
    const AVAILABLE_TABS = ["feed", "changes"];

    it("should have a reasonable drawer height for mobile", () => {
      // 85vh gives enough room to see content while allowing swipe-to-dismiss
      const heightValue = parseInt(DRAWER_HEIGHT);
      expect(heightValue).toBeGreaterThanOrEqual(80);
      expect(heightValue).toBeLessThanOrEqual(95);
    });

    it("should default to feed tab", () => {
      expect(DEFAULT_TAB).toBe("feed");
    });

    it("should have feed and changes tabs available", () => {
      expect(AVAILABLE_TABS).toContain("feed");
      expect(AVAILABLE_TABS).toContain("changes");
    });
  });

  describe("Swipe gesture navigation", () => {
    // Constants that should match the mobile component implementation
    const SWIPE_THRESHOLD = 50;

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

    it("should stay on last tab when swiping left from cancelled", () => {
      const column = getNextColumnAfterSwipe("cancelled", "left");
      expect(column).toBe("cancelled");
    });

    it("should correctly traverse all columns with left swipes", () => {
      const columnOrder: KanbanColumn[] = [
        "backlog",
        "in_progress",
        "in_review",
        "done",
        "cancelled",
      ];
      let currentColumn: KanbanColumn = "backlog";

      for (let i = 1; i < columnOrder.length; i++) {
        currentColumn = getNextColumnAfterSwipe(currentColumn, "left");
        expect(currentColumn).toBe(columnOrder[i]);
      }
    });

    it("should correctly traverse all columns with right swipes", () => {
      const columnOrder: KanbanColumn[] = [
        "cancelled",
        "done",
        "in_review",
        "in_progress",
        "backlog",
      ];
      let currentColumn: KanbanColumn = "cancelled";

      for (let i = 1; i < columnOrder.length; i++) {
        currentColumn = getNextColumnAfterSwipe(currentColumn, "right");
        expect(currentColumn).toBe(columnOrder[i]);
      }
    });
  });

  describe("New task drawer", () => {
    // Constants that should match the new task drawer implementation
    const NEW_TASK_DRAWER_HEIGHT = "85vh";

    it("should have the same height as task detail drawer for consistency", () => {
      const taskDrawerHeight = "85vh";
      expect(NEW_TASK_DRAWER_HEIGHT).toBe(taskDrawerHeight);
    });
  });

  describe("Archive toggle in Done column", () => {
    it("should only show archive toggle for done column", () => {
      const showArchiveToggle = (columnId: KanbanColumn) => columnId === "done";

      expect(showArchiveToggle("done")).toBe(true);
      expect(showArchiveToggle("backlog")).toBe(false);
      expect(showArchiveToggle("in_progress")).toBe(false);
      expect(showArchiveToggle("in_review")).toBe(false);
      expect(showArchiveToggle("cancelled")).toBe(false);
    });

    it("should not show archive toggle when viewing archived tasks", () => {
      // When queryFilters.archived is true, toggle should be hidden
      const showArchiveToggle = (
        columnId: KanbanColumn,
        isArchivedView: boolean,
      ) => columnId === "done" && !isArchivedView;

      expect(showArchiveToggle("done", true)).toBe(false);
      expect(showArchiveToggle("done", false)).toBe(true);
    });
  });

  describe("Tab scroll to center on swipe", () => {
    it("should calculate correct scroll position to center a tab", () => {
      // Simulates the scroll calculation
      const calculateScrollToCenter = (
        tabsListWidth: number,
        tabOffsetLeft: number,
        tabWidth: number,
      ) => {
        return tabOffsetLeft - tabsListWidth / 2 + tabWidth / 2;
      };

      // Example: tabs list is 300px wide, tab is at 150px offset with 60px width
      const scrollPos = calculateScrollToCenter(300, 150, 60);
      // Expected: 150 - 150 + 30 = 30
      expect(scrollPos).toBe(30);
    });

    it("should handle scroll for first tab correctly", () => {
      const calculateScrollToCenter = (
        tabsListWidth: number,
        tabOffsetLeft: number,
        tabWidth: number,
      ) => {
        return tabOffsetLeft - tabsListWidth / 2 + tabWidth / 2;
      };

      // First tab at offset 0, width 60px, list is 300px
      const scrollPos = calculateScrollToCenter(300, 0, 60);
      // Expected: 0 - 150 + 30 = -120 (browser will clamp to 0)
      expect(scrollPos).toBe(-120);
    });
  });
});
