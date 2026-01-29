import { describe, test, expect } from "vitest";
import {
  SecondaryPanelView,
  defaultSecondaryPanelView,
  getDefaultUserCookies,
  secondaryPanelViewKey,
} from "./cookies";

describe("SecondaryPanelView", () => {
  test("defaultSecondaryPanelView is files-changed", () => {
    expect(defaultSecondaryPanelView).toBe("files-changed");
  });

  test("SecondaryPanelView type includes all expected values", () => {
    // This test verifies the type includes all the expected values
    // by assigning them to a variable of that type
    const views: SecondaryPanelView[] = [
      "files-changed",
      "comments",
      "checks",
      "coverage",
      "merge",
    ];

    expect(views).toHaveLength(5);
    expect(views).toContain("files-changed");
    expect(views).toContain("comments");
    expect(views).toContain("checks");
    expect(views).toContain("coverage");
    expect(views).toContain("merge");
  });

  test("getDefaultUserCookies includes secondary panel view key", () => {
    const defaults = getDefaultUserCookies();
    expect(defaults[secondaryPanelViewKey]).toBe("files-changed");
  });
});
