import { describe, expect, it } from "vitest";
import { shouldShowAddToBacklog } from "./kanban-column";

describe("KanbanColumn", () => {
  describe("shouldShowAddToBacklog", () => {
    it("returns true only for backlog with handler", () => {
      expect(shouldShowAddToBacklog("backlog", () => {})).toBe(true);
    });

    it("returns false for backlog without handler", () => {
      expect(shouldShowAddToBacklog("backlog")).toBe(false);
    });

    it("returns false for non-backlog columns", () => {
      expect(shouldShowAddToBacklog("in_progress", () => {})).toBe(false);
      expect(shouldShowAddToBacklog("in_review", () => {})).toBe(false);
      expect(shouldShowAddToBacklog("done", () => {})).toBe(false);
      expect(shouldShowAddToBacklog("failed", () => {})).toBe(false);
    });
  });
});
