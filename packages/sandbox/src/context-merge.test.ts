import { describe, expect, it } from "vitest";
import { mergeContextContent } from "./context-merge";

describe("mergeContextContent", () => {
  it("should return null when both inputs are null", () => {
    const result = mergeContextContent({
      customSystemPrompt: null,
      smartContext: null,
    });
    expect(result).toBeNull();
  });

  it("should return null when both inputs are undefined", () => {
    const result = mergeContextContent({});
    expect(result).toBeNull();
  });

  it("should return null when both inputs are empty strings", () => {
    const result = mergeContextContent({
      customSystemPrompt: "",
      smartContext: "",
    });
    expect(result).toBeNull();
  });

  it("should return null when both inputs are whitespace only", () => {
    const result = mergeContextContent({
      customSystemPrompt: "   ",
      smartContext: "  \n\t  ",
    });
    expect(result).toBeNull();
  });

  it("should return only smart context when custom prompt is null", () => {
    const result = mergeContextContent({
      customSystemPrompt: null,
      smartContext: "# Project\n\nThis is a TypeScript project.",
    });
    expect(result).toBe("# Project\n\nThis is a TypeScript project.");
  });

  it("should return only smart context when custom prompt is empty", () => {
    const result = mergeContextContent({
      customSystemPrompt: "",
      smartContext: "# My Project\n\nUses React and Node.js.",
    });
    expect(result).toBe("# My Project\n\nUses React and Node.js.");
  });

  it("should return only custom prompt when smart context is null", () => {
    const result = mergeContextContent({
      customSystemPrompt: "Always use TypeScript strict mode.",
      smartContext: null,
    });
    expect(result).toBe("Always use TypeScript strict mode.");
  });

  it("should return only custom prompt when smart context is empty", () => {
    const result = mergeContextContent({
      customSystemPrompt: "Prefer functional components.",
      smartContext: "",
    });
    expect(result).toBe("Prefer functional components.");
  });

  it("should merge both contexts with smart context first", () => {
    const result = mergeContextContent({
      customSystemPrompt: "Always write tests.",
      smartContext: "# My Project\n\nUses TypeScript.",
    });

    expect(result).toBe(`# My Project

Uses TypeScript.

---

## Custom Instructions

Always write tests.`);
  });

  it("should trim whitespace from both inputs when merging", () => {
    const result = mergeContextContent({
      customSystemPrompt: "  Custom instructions  \n",
      smartContext: "\n  # Project  \n",
    });

    expect(result).toBe(`# Project

---

## Custom Instructions

Custom instructions`);
  });

  it("should handle multiline content correctly", () => {
    const smartContext = `# my-app

## Tech Stack
- TypeScript
- React
- Next.js

## Commands
- \`pnpm dev\` - Start development server
- \`pnpm test\` - Run tests`;

    const customPrompt = `Follow these guidelines:
1. Use functional components
2. Prefer hooks over class components
3. Write unit tests for all utilities`;

    const result = mergeContextContent({
      customSystemPrompt: customPrompt,
      smartContext,
    });

    expect(result).toContain("# my-app");
    expect(result).toContain("## Tech Stack");
    expect(result).toContain("## Custom Instructions");
    expect(result).toContain("Follow these guidelines:");
    expect(result).toContain("---");
  });
});
