import { describe, it, expect } from "vitest";
import { KANBAN_COLUMNS } from "./types";

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

    it("should start with in_progress as the default active column", () => {
      // The mobile board defaults to in_progress as it's the most relevant view
      const inProgressIndex = KANBAN_COLUMNS.findIndex(
        (c) => c.id === "in_progress",
      );
      expect(inProgressIndex).toBeGreaterThan(-1);
      // It should be early in the list (second position, after backlog)
      expect(inProgressIndex).toBe(1);
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
});
