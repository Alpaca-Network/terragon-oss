import { describe, expect, it } from "vitest";
import { shouldShowAddToBacklog, shouldShowScrollHint } from "./kanban-column";

describe("KanbanColumn helpers", () => {
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

  describe("shouldShowScrollHint", () => {
    it("shows hint when content exceeds threshold", () => {
      expect(shouldShowScrollHint(500, 450)).toBe(true);
    });

    it("does not show hint when content fits", () => {
      expect(shouldShowScrollHint(450, 450)).toBe(false);
    });

    it("respects custom threshold", () => {
      expect(shouldShowScrollHint(470, 450, 30)).toBe(false);
      expect(shouldShowScrollHint(481, 450, 30)).toBe(true);
    });
  });
});
