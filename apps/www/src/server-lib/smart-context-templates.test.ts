import { describe, expect, it } from "vitest";
import {
  generateClaudeMdContent,
  getAIAnalysisPrompt,
  AnalysisResult,
  DetectedStack,
} from "./smart-context-templates";

describe("generateClaudeMdContent", () => {
  it("should generate basic content with project name", () => {
    const analysis: AnalysisResult = {
      projectName: "my-project",
      stack: {
        languages: [],
        frameworks: [],
        packageManager: null,
        testFramework: null,
        buildTool: null,
      },
      commands: {
        dev: null,
        build: null,
        test: null,
        lint: null,
        start: null,
      },
      structure: {
        isMonorepo: false,
        hasDocker: false,
        hasCICD: false,
        sourceDirectories: [],
        configFiles: [],
      },
      existingContext: null,
      aiInsights: null,
    };

    const result = generateClaudeMdContent(analysis);
    expect(result).toContain("# my-project");
  });

  it("should include tech stack section", () => {
    const analysis: AnalysisResult = {
      projectName: "my-project",
      stack: {
        languages: ["TypeScript"],
        frameworks: ["Next.js", "React"],
        packageManager: "pnpm",
        testFramework: "Vitest",
        buildTool: "Turborepo",
      },
      commands: {
        dev: null,
        build: null,
        test: null,
        lint: null,
        start: null,
      },
      structure: {
        isMonorepo: false,
        hasDocker: false,
        hasCICD: false,
        sourceDirectories: [],
        configFiles: [],
      },
      existingContext: null,
      aiInsights: null,
    };

    const result = generateClaudeMdContent(analysis);
    expect(result).toContain("## Tech Stack");
    expect(result).toContain("TypeScript");
    expect(result).toContain("Next.js, React");
    expect(result).toContain("pnpm");
    expect(result).toContain("Vitest");
    expect(result).toContain("Turborepo");
  });

  it("should include commands section", () => {
    const analysis: AnalysisResult = {
      projectName: "my-project",
      stack: {
        languages: [],
        frameworks: [],
        packageManager: null,
        testFramework: null,
        buildTool: null,
      },
      commands: {
        dev: "pnpm dev",
        build: "pnpm build",
        test: "pnpm test",
        lint: "pnpm lint",
        start: null,
      },
      structure: {
        isMonorepo: false,
        hasDocker: false,
        hasCICD: false,
        sourceDirectories: [],
        configFiles: [],
      },
      existingContext: null,
      aiInsights: null,
    };

    const result = generateClaudeMdContent(analysis);
    expect(result).toContain("## Key Commands");
    expect(result).toContain("`pnpm dev`");
    expect(result).toContain("`pnpm build`");
    expect(result).toContain("`pnpm test`");
    expect(result).toContain("`pnpm lint`");
  });

  it("should include project structure section", () => {
    const analysis: AnalysisResult = {
      projectName: "my-project",
      stack: {
        languages: [],
        frameworks: [],
        packageManager: null,
        testFramework: null,
        buildTool: null,
      },
      commands: {
        dev: null,
        build: null,
        test: null,
        lint: null,
        start: null,
      },
      structure: {
        isMonorepo: true,
        hasDocker: true,
        hasCICD: true,
        sourceDirectories: ["src", "packages"],
        configFiles: [],
      },
      existingContext: null,
      aiInsights: null,
    };

    const result = generateClaudeMdContent(analysis);
    expect(result).toContain("## Project Structure");
    expect(result).toContain("monorepo");
    expect(result).toContain("Docker");
    expect(result).toContain("CI/CD");
    expect(result).toContain("`src`");
    expect(result).toContain("`packages`");
  });

  it("should include AI insights section", () => {
    const analysis: AnalysisResult = {
      projectName: "my-project",
      stack: {
        languages: [],
        frameworks: [],
        packageManager: null,
        testFramework: null,
        buildTool: null,
      },
      commands: {
        dev: null,
        build: null,
        test: null,
        lint: null,
        start: null,
      },
      structure: {
        isMonorepo: false,
        hasDocker: false,
        hasCICD: false,
        sourceDirectories: [],
        configFiles: [],
      },
      existingContext: null,
      aiInsights:
        "- Use camelCase for variable names\n- Components should be in PascalCase",
    };

    const result = generateClaudeMdContent(analysis);
    expect(result).toContain("## Conventions & Patterns");
    expect(result).toContain("camelCase");
    expect(result).toContain("PascalCase");
  });

  it("should include existing context section", () => {
    const analysis: AnalysisResult = {
      projectName: "my-project",
      stack: {
        languages: [],
        frameworks: [],
        packageManager: null,
        testFramework: null,
        buildTool: null,
      },
      commands: {
        dev: null,
        build: null,
        test: null,
        lint: null,
        start: null,
      },
      structure: {
        isMonorepo: false,
        hasDocker: false,
        hasCICD: false,
        sourceDirectories: [],
        configFiles: [],
      },
      existingContext:
        "### From `CLAUDE.md`:\nThis is an existing context file.",
      aiInsights: null,
    };

    const result = generateClaudeMdContent(analysis);
    expect(result).toContain("## Repository Context");
    expect(result).toContain("existing context file");
  });
});

describe("getAIAnalysisPrompt", () => {
  it("should generate a prompt with file samples", () => {
    const sampleFiles = [
      { path: "src/index.ts", content: "export const foo = 1;" },
      { path: "package.json", content: '{"name": "test"}' },
    ];
    const stack: DetectedStack = {
      languages: ["TypeScript"],
      frameworks: ["React"],
      packageManager: "npm",
      testFramework: null,
      buildTool: null,
    };

    const prompt = getAIAnalysisPrompt(sampleFiles, stack);

    expect(prompt).toContain("TypeScript");
    expect(prompt).toContain("React");
    expect(prompt).toContain("### src/index.ts");
    expect(prompt).toContain("### package.json");
    expect(prompt).toContain("export const foo = 1;");
    expect(prompt).toContain("Naming conventions");
    expect(prompt).toContain("Code organization patterns");
  });

  it("should include detected tech stack in the prompt", () => {
    const sampleFiles = [{ path: "test.py", content: "def main(): pass" }];
    const stack: DetectedStack = {
      languages: ["Python"],
      frameworks: ["Django", "FastAPI"],
      packageManager: "pip",
      testFramework: "pytest",
      buildTool: null,
    };

    const prompt = getAIAnalysisPrompt(sampleFiles, stack);

    expect(prompt).toContain("Python");
    expect(prompt).toContain("Django, FastAPI");
    expect(prompt).toContain("pip");
  });
});
