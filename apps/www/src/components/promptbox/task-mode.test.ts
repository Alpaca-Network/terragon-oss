import { describe, it, expect } from "vitest";
import {
  buildTemplateDoc,
  permissionModeFromTaskMode,
  taskModeFromPermissionMode,
} from "./task-mode";

describe("taskMode mapping", () => {
  it("maps permission modes to task modes", () => {
    expect(taskModeFromPermissionMode("allowAll")).toBe("execute");
    expect(taskModeFromPermissionMode("plan")).toBe("plan");
    expect(taskModeFromPermissionMode("loop")).toBe("loop");
  });

  it("maps task modes to permission modes", () => {
    expect(permissionModeFromTaskMode("execute")).toBe("allowAll");
    expect(permissionModeFromTaskMode("plan")).toBe("plan");
    expect(permissionModeFromTaskMode("loop")).toBe("loop");
    expect(permissionModeFromTaskMode("template")).toBe("plan");
  });
});

describe("buildTemplateDoc", () => {
  it("creates paragraphs for each line", () => {
    const doc = buildTemplateDoc("Line one\nLine two");
    expect(doc).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Line one" }] },
        { type: "paragraph", content: [{ type: "text", text: "Line two" }] },
      ],
    });
  });

  it("preserves empty lines as empty paragraphs", () => {
    const doc = buildTemplateDoc("First\n\nThird");
    expect(doc).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First" }] },
        { type: "paragraph", content: [] },
        { type: "paragraph", content: [{ type: "text", text: "Third" }] },
      ],
    });
  });
});
