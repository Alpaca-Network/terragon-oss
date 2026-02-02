import { describe, expect, it } from "vitest";
import { shouldShowScrollHint } from "./kanban-column";

describe("Kanban column scroll hint", () => {
  it("should show hint when content exceeds threshold", () => {
    expect(shouldShowScrollHint(500, 450)).toBe(true);
  });

  it("should not show hint when content fits", () => {
    expect(shouldShowScrollHint(450, 450)).toBe(false);
  });

  it("should respect custom threshold", () => {
    expect(shouldShowScrollHint(470, 450, 30)).toBe(false);
    expect(shouldShowScrollHint(481, 450, 30)).toBe(true);
  });
});
