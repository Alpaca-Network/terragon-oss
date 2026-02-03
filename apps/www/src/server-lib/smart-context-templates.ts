/**
 * Smart Context Generation Templates
 *
 * Template-based generation for project structure and common patterns.
 * Used in combination with AI-powered analysis for deeper insights.
 */

export interface DetectedStack {
  languages: string[];
  frameworks: string[];
  packageManager: string | null;
  testFramework: string | null;
  buildTool: string | null;
}

export interface DetectedCommands {
  dev: string | null;
  build: string | null;
  test: string | null;
  lint: string | null;
  start: string | null;
}

export interface DetectedStructure {
  isMonorepo: boolean;
  hasDocker: boolean;
  hasCICD: boolean;
  sourceDirectories: string[];
  configFiles: string[];
}

export interface AnalysisResult {
  projectName: string;
  stack: DetectedStack;
  commands: DetectedCommands;
  structure: DetectedStructure;
  existingContext: string | null;
  aiInsights: string | null;
}

/**
 * Framework detection patterns for package.json dependencies
 */
export const FRAMEWORK_PATTERNS: Record<
  string,
  { name: string; category: string }
> = {
  // JavaScript/TypeScript Frameworks
  next: { name: "Next.js", category: "frontend" },
  react: { name: "React", category: "frontend" },
  vue: { name: "Vue.js", category: "frontend" },
  angular: { name: "Angular", category: "frontend" },
  svelte: { name: "Svelte", category: "frontend" },
  express: { name: "Express.js", category: "backend" },
  fastify: { name: "Fastify", category: "backend" },
  nestjs: { name: "NestJS", category: "backend" },
  "@nestjs/core": { name: "NestJS", category: "backend" },
  hono: { name: "Hono", category: "backend" },
  koa: { name: "Koa", category: "backend" },
  // Testing
  vitest: { name: "Vitest", category: "testing" },
  jest: { name: "Jest", category: "testing" },
  mocha: { name: "Mocha", category: "testing" },
  playwright: { name: "Playwright", category: "testing" },
  cypress: { name: "Cypress", category: "testing" },
  // Build tools
  vite: { name: "Vite", category: "build" },
  webpack: { name: "Webpack", category: "build" },
  esbuild: { name: "esbuild", category: "build" },
  turbo: { name: "Turborepo", category: "build" },
  // ORM/Database
  prisma: { name: "Prisma", category: "database" },
  drizzle: { name: "Drizzle ORM", category: "database" },
  "drizzle-orm": { name: "Drizzle ORM", category: "database" },
  typeorm: { name: "TypeORM", category: "database" },
  mongoose: { name: "Mongoose", category: "database" },
  // State management
  zustand: { name: "Zustand", category: "state" },
  jotai: { name: "Jotai", category: "state" },
  redux: { name: "Redux", category: "state" },
  "@tanstack/react-query": { name: "TanStack Query", category: "data" },
  // UI
  tailwindcss: { name: "Tailwind CSS", category: "styling" },
  "@radix-ui/react-dialog": { name: "Radix UI", category: "ui" },
  "shadcn-ui": { name: "shadcn/ui", category: "ui" },
};

/**
 * Python framework detection patterns
 */
export const PYTHON_FRAMEWORK_PATTERNS: Record<
  string,
  { name: string; category: string }
> = {
  django: { name: "Django", category: "backend" },
  flask: { name: "Flask", category: "backend" },
  fastapi: { name: "FastAPI", category: "backend" },
  pytest: { name: "pytest", category: "testing" },
  sqlalchemy: { name: "SQLAlchemy", category: "database" },
  celery: { name: "Celery", category: "task-queue" },
  pandas: { name: "pandas", category: "data" },
  numpy: { name: "NumPy", category: "data" },
  tensorflow: { name: "TensorFlow", category: "ml" },
  pytorch: { name: "PyTorch", category: "ml" },
  torch: { name: "PyTorch", category: "ml" },
};

/**
 * Generate the CLAUDE.md content from analysis results
 */
export function generateClaudeMdContent(analysis: AnalysisResult): string {
  const sections: string[] = [];

  // Project name header
  sections.push(`# ${analysis.projectName}`);

  // Tech stack section
  const stackLines: string[] = [];
  if (analysis.stack.languages.length > 0) {
    stackLines.push(`- **Languages**: ${analysis.stack.languages.join(", ")}`);
  }
  if (analysis.stack.frameworks.length > 0) {
    stackLines.push(
      `- **Frameworks**: ${analysis.stack.frameworks.join(", ")}`,
    );
  }
  if (analysis.stack.packageManager) {
    stackLines.push(`- **Package Manager**: ${analysis.stack.packageManager}`);
  }
  if (analysis.stack.testFramework) {
    stackLines.push(`- **Testing**: ${analysis.stack.testFramework}`);
  }
  if (analysis.stack.buildTool) {
    stackLines.push(`- **Build Tool**: ${analysis.stack.buildTool}`);
  }
  if (stackLines.length > 0) {
    sections.push(`## Tech Stack\n${stackLines.join("\n")}`);
  }

  // Project structure section
  const structureLines: string[] = [];
  if (analysis.structure.isMonorepo) {
    structureLines.push("- This is a **monorepo** project");
  }
  if (analysis.structure.sourceDirectories.length > 0) {
    structureLines.push(
      `- **Source directories**: ${analysis.structure.sourceDirectories.map((d) => `\`${d}\``).join(", ")}`,
    );
  }
  if (analysis.structure.hasDocker) {
    structureLines.push("- Docker configuration available");
  }
  if (analysis.structure.hasCICD) {
    structureLines.push("- CI/CD workflows configured");
  }
  if (structureLines.length > 0) {
    sections.push(`## Project Structure\n${structureLines.join("\n")}`);
  }

  // Commands section
  const commandLines: string[] = [];
  if (analysis.commands.dev) {
    commandLines.push(`- **Development**: \`${analysis.commands.dev}\``);
  }
  if (analysis.commands.build) {
    commandLines.push(`- **Build**: \`${analysis.commands.build}\``);
  }
  if (analysis.commands.test) {
    commandLines.push(`- **Test**: \`${analysis.commands.test}\``);
  }
  if (analysis.commands.lint) {
    commandLines.push(`- **Lint**: \`${analysis.commands.lint}\``);
  }
  if (analysis.commands.start) {
    commandLines.push(`- **Start**: \`${analysis.commands.start}\``);
  }
  if (commandLines.length > 0) {
    sections.push(`## Key Commands\n${commandLines.join("\n")}`);
  }

  // AI-generated insights section
  if (analysis.aiInsights) {
    sections.push(`## Conventions & Patterns\n${analysis.aiInsights}`);
  }

  // Existing context (from CLAUDE.md/AGENTS.md in repo)
  if (analysis.existingContext) {
    sections.push(
      `## Repository Context\n\n*The following context was found in the repository:*\n\n${analysis.existingContext}`,
    );
  }

  return sections.join("\n\n");
}

/**
 * AI prompt template for analyzing code patterns and conventions
 */
export function getAIAnalysisPrompt(
  sampleFiles: Array<{ path: string; content: string }>,
  detectedStack: DetectedStack,
): string {
  const fileList = sampleFiles
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  return `Analyze the following code samples from a ${detectedStack.frameworks.join(", ") || detectedStack.languages.join(", ")} project and identify coding conventions, patterns, and best practices.

## Detected Tech Stack
- Languages: ${detectedStack.languages.join(", ") || "Unknown"}
- Frameworks: ${detectedStack.frameworks.join(", ") || "None detected"}
- Package Manager: ${detectedStack.packageManager || "Unknown"}

## Code Samples
${fileList}

## Instructions
Based on these code samples, provide a concise summary of:
1. **Naming conventions** (variables, functions, files)
2. **Code organization patterns** (how code is structured)
3. **Error handling approach**
4. **Testing patterns** (if test files are included)
5. **Any project-specific conventions** that should be followed

Keep the response focused and actionable - these will be instructions for an AI coding assistant.
Format as bullet points, not numbered lists. Be concise (max 10-15 bullet points total).
Do not include generic advice - only patterns specific to this codebase.`;
}
