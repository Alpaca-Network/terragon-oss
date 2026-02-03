/**
 * Smart Context Analyzer
 *
 * Hybrid analysis engine that combines:
 * 1. Template-based detection for tech stack and commands
 * 2. AI-powered analysis for code conventions and patterns
 */

import { ISandboxSession } from "@terragon/sandbox/types";
import Anthropic from "@anthropic-ai/sdk";
import {
  AnalysisResult,
  DetectedStack,
  DetectedCommands,
  DetectedStructure,
  FRAMEWORK_PATTERNS,
  PYTHON_FRAMEWORK_PATTERNS,
  generateClaudeMdContent,
  getAIAnalysisPrompt,
} from "./smart-context-templates";

export type AnalysisProgressCallback = (
  step: string,
  message: string,
) => Promise<void>;

export interface AnalyzeCodebaseOptions {
  session: ISandboxSession;
  repoFullName: string;
  onProgress: AnalysisProgressCallback;
  anthropicApiKey?: string;
}

/**
 * Main entry point for codebase analysis
 */
export async function analyzeCodebase({
  session,
  repoFullName,
  onProgress,
  anthropicApiKey,
}: AnalyzeCodebaseOptions): Promise<string> {
  const projectName = repoFullName.split("/").pop() || repoFullName;

  // Phase 1: Fast detection (template-based)
  await onProgress("detecting", "Scanning for project manifest files...");
  const stack = await detectStack(session);

  await onProgress("detecting", "Analyzing project structure...");
  const structure = await detectStructure(session);

  await onProgress("detecting", "Extracting commands from package.json...");
  const commands = await detectCommands(session, stack.packageManager);

  await onProgress("reading", "Looking for existing context files...");
  const existingContext = await readExistingContext(session);

  // Phase 2: AI-powered analysis (if API key available)
  let aiInsights: string | null = null;
  if (anthropicApiKey) {
    await onProgress("analyzing", "Sampling key files for AI analysis...");
    const sampleFiles = await sampleKeyFiles(session, structure);

    if (sampleFiles.length > 0) {
      await onProgress(
        "analyzing",
        `Analyzing ${sampleFiles.length} files with AI...`,
      );
      aiInsights = await runAIAnalysis(sampleFiles, stack, anthropicApiKey);
    }
  } else {
    await onProgress(
      "analyzing",
      "Skipping AI analysis (no API key available)",
    );
  }

  // Phase 3: Generate context
  await onProgress("generating", "Generating smart context...");
  const analysisResult: AnalysisResult = {
    projectName,
    stack,
    commands,
    structure,
    existingContext,
    aiInsights,
  };

  const generatedContext = generateClaudeMdContent(analysisResult);

  await onProgress("complete", "Analysis complete!");
  return generatedContext;
}

/**
 * Detect tech stack from manifest files
 */
async function detectStack(session: ISandboxSession): Promise<DetectedStack> {
  const stack: DetectedStack = {
    languages: [],
    frameworks: [],
    packageManager: null,
    testFramework: null,
    buildTool: null,
  };

  // Check for Node.js project
  const packageJsonContent = await safeReadFile(session, "package.json");
  if (packageJsonContent) {
    stack.languages.push("TypeScript/JavaScript");

    // Detect package manager
    if (await fileExists(session, "pnpm-lock.yaml")) {
      stack.packageManager = "pnpm";
    } else if (await fileExists(session, "yarn.lock")) {
      stack.packageManager = "yarn";
    } else if (await fileExists(session, "bun.lockb")) {
      stack.packageManager = "bun";
    } else if (await fileExists(session, "package-lock.json")) {
      stack.packageManager = "npm";
    }

    // Parse package.json for frameworks
    try {
      const pkg = JSON.parse(packageJsonContent);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      for (const [dep, info] of Object.entries(FRAMEWORK_PATTERNS)) {
        if (allDeps[dep]) {
          if (info.category === "testing" && !stack.testFramework) {
            stack.testFramework = info.name;
          } else if (info.category === "build" && !stack.buildTool) {
            stack.buildTool = info.name;
          } else if (!stack.frameworks.includes(info.name)) {
            stack.frameworks.push(info.name);
          }
        }
      }

      // Check for TypeScript
      if (allDeps["typescript"]) {
        stack.languages = ["TypeScript"];
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Check for Python project
  const requirementsTxt = await safeReadFile(session, "requirements.txt");
  const pyprojectToml = await safeReadFile(session, "pyproject.toml");

  if (requirementsTxt || pyprojectToml) {
    if (!stack.languages.includes("Python")) {
      stack.languages.push("Python");
    }
    stack.packageManager = stack.packageManager || "pip";

    const pythonDeps = (requirementsTxt || pyprojectToml || "").toLowerCase();
    for (const [dep, info] of Object.entries(PYTHON_FRAMEWORK_PATTERNS)) {
      if (pythonDeps.includes(dep)) {
        if (info.category === "testing" && !stack.testFramework) {
          stack.testFramework = info.name;
        } else if (!stack.frameworks.includes(info.name)) {
          stack.frameworks.push(info.name);
        }
      }
    }
  }

  // Check for Go project
  if (await fileExists(session, "go.mod")) {
    stack.languages.push("Go");
    stack.packageManager = "go modules";
  }

  // Check for Rust project
  if (await fileExists(session, "Cargo.toml")) {
    stack.languages.push("Rust");
    stack.packageManager = "cargo";
  }

  // Check for Ruby project
  if (await fileExists(session, "Gemfile")) {
    stack.languages.push("Ruby");
    stack.packageManager = "bundler";
  }

  // Check for Java project
  if (
    (await fileExists(session, "pom.xml")) ||
    (await fileExists(session, "build.gradle"))
  ) {
    stack.languages.push("Java");
    stack.packageManager = (await fileExists(session, "pom.xml"))
      ? "maven"
      : "gradle";
  }

  return stack;
}

/**
 * Detect project structure
 */
async function detectStructure(
  session: ISandboxSession,
): Promise<DetectedStructure> {
  const structure: DetectedStructure = {
    isMonorepo: false,
    hasDocker: false,
    hasCICD: false,
    sourceDirectories: [],
    configFiles: [],
  };

  // Check for monorepo indicators
  if (
    (await fileExists(session, "pnpm-workspace.yaml")) ||
    (await fileExists(session, "lerna.json")) ||
    (await fileExists(session, "turbo.json"))
  ) {
    structure.isMonorepo = true;
  }

  // Check for Docker
  if (
    (await fileExists(session, "Dockerfile")) ||
    (await fileExists(session, "docker-compose.yml")) ||
    (await fileExists(session, "docker-compose.yaml"))
  ) {
    structure.hasDocker = true;
  }

  // Check for CI/CD
  if (
    (await directoryExists(session, ".github/workflows")) ||
    (await fileExists(session, ".gitlab-ci.yml")) ||
    (await fileExists(session, ".circleci/config.yml"))
  ) {
    structure.hasCICD = true;
  }

  // Detect common source directories
  const commonDirs = [
    "src",
    "lib",
    "app",
    "apps",
    "packages",
    "components",
    "pages",
    "api",
    "server",
    "client",
    "test",
    "tests",
    "__tests__",
  ];
  for (const dir of commonDirs) {
    if (await directoryExists(session, dir)) {
      structure.sourceDirectories.push(dir);
    }
  }

  // Detect config files
  const configPatterns = [
    "tsconfig.json",
    "eslint.config.js",
    ".eslintrc.js",
    ".eslintrc.json",
    "prettier.config.js",
    ".prettierrc",
    "vitest.config.ts",
    "jest.config.js",
    "tailwind.config.js",
    "tailwind.config.ts",
    "next.config.js",
    "next.config.ts",
    "vite.config.ts",
  ];
  for (const config of configPatterns) {
    if (await fileExists(session, config)) {
      structure.configFiles.push(config);
    }
  }

  return structure;
}

/**
 * Detect commands from package.json scripts
 */
async function detectCommands(
  session: ISandboxSession,
  packageManager: string | null,
): Promise<DetectedCommands> {
  const commands: DetectedCommands = {
    dev: null,
    build: null,
    test: null,
    lint: null,
    start: null,
  };

  const packageJsonContent = await safeReadFile(session, "package.json");
  if (!packageJsonContent) {
    return commands;
  }

  try {
    const pkg = JSON.parse(packageJsonContent);
    const scripts = pkg.scripts || {};
    const pm = packageManager || "npm";
    // npm uses "npm run", pnpm/yarn/bun use "<pm> run" for scripts
    const run = pm === "npm" ? "npm run" : `${pm} run`;

    if (scripts.dev) commands.dev = `${run} dev`;
    if (scripts.build) commands.build = `${run} build`;
    if (scripts.test) commands.test = `${run} test`;
    if (scripts.lint) commands.lint = `${run} lint`;
    if (scripts.start) commands.start = `${run} start`;
  } catch {
    // Ignore parse errors
  }

  return commands;
}

/**
 * Read existing context files (CLAUDE.md, AGENTS.md, etc.)
 */
async function readExistingContext(
  session: ISandboxSession,
): Promise<string | null> {
  const contextFiles = [
    "CLAUDE.md",
    "AGENTS.md",
    ".cursorrules",
    ".github/copilot-instructions.md",
  ];

  const contents: string[] = [];

  for (const file of contextFiles) {
    const content = await safeReadFile(session, file);
    if (content && content.trim()) {
      contents.push(`### From \`${file}\`:\n${content.trim()}`);
    }
  }

  return contents.length > 0 ? contents.join("\n\n") : null;
}

/**
 * Sample key files for AI analysis
 */
async function sampleKeyFiles(
  session: ISandboxSession,
  structure: DetectedStructure,
): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];
  const maxTotalSize = 50000; // 50KB limit
  let currentSize = 0;

  // Priority files to sample
  const priorityFiles = [
    "README.md",
    "package.json",
    "tsconfig.json",
    ...structure.configFiles,
  ];

  // Add priority files
  for (const file of priorityFiles) {
    if (currentSize >= maxTotalSize) break;

    const content = await safeReadFile(session, file, 5000);
    if (content) {
      files.push({ path: file, content });
      currentSize += content.length;
    }
  }

  // Sample from source directories
  const srcPatterns = [
    "src/index.ts",
    "src/index.tsx",
    "src/main.ts",
    "src/main.tsx",
    "src/app.ts",
    "src/app.tsx",
    "app/page.tsx",
    "app/layout.tsx",
    "pages/index.tsx",
    "lib/index.ts",
    "src/lib/utils.ts",
  ];

  for (const pattern of srcPatterns) {
    if (currentSize >= maxTotalSize) break;

    const content = await safeReadFile(session, pattern, 3000);
    if (content) {
      files.push({ path: pattern, content });
      currentSize += content.length;
    }
  }

  // Try to find a test file - check common test locations
  const testFiles = [
    "src/index.test.ts",
    "src/lib/utils.test.ts",
    "test/index.test.ts",
    "tests/index.test.ts",
  ];

  for (const testFile of testFiles) {
    if (currentSize >= maxTotalSize) break;

    const content = await safeReadFile(session, testFile, 2000);
    if (content) {
      files.push({ path: testFile, content });
      currentSize += content.length;
      break;
    }
  }

  return files;
}

/**
 * Run AI analysis on sampled files
 */
async function runAIAnalysis(
  sampleFiles: Array<{ path: string; content: string }>,
  stack: DetectedStack,
  anthropicApiKey: string,
): Promise<string | null> {
  try {
    const client = new Anthropic({
      apiKey: anthropicApiKey,
    });

    const prompt = getAIAnalysisPrompt(sampleFiles, stack);

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (textContent && textContent.type === "text") {
      return textContent.text;
    }

    return null;
  } catch (error) {
    console.error("AI analysis failed:", error);
    return null;
  }
}

// Utility functions

async function safeReadFile(
  session: ISandboxSession,
  path: string,
  maxLength?: number,
): Promise<string | null> {
  try {
    const content = await session.readTextFile(path);
    if (maxLength && content.length > maxLength) {
      return content.slice(0, maxLength) + "\n... (truncated)";
    }
    return content;
  } catch {
    return null;
  }
}

async function fileExists(
  session: ISandboxSession,
  path: string,
): Promise<boolean> {
  try {
    const result = await session.runCommand(`test -f "${path}" && echo "yes"`, {
      cwd: session.repoDir,
    });
    return result.trim() === "yes";
  } catch {
    return false;
  }
}

async function directoryExists(
  session: ISandboxSession,
  path: string,
): Promise<boolean> {
  try {
    const result = await session.runCommand(`test -d "${path}" && echo "yes"`, {
      cwd: session.repoDir,
    });
    return result.trim() === "yes";
  } catch {
    return false;
  }
}
