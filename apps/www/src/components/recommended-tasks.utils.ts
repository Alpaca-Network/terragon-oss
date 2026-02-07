import type { AIModel } from "@terragon/agent/types";
import { modelToAgent } from "@terragon/agent/utils";

export interface RecommendedTask {
  id: string;
  label: string;
  shortDescription: string;
  prompt: string;
  icon: string;
}

const COMMON_RECOMMENDED_TASKS: RecommendedTask[] = [
  {
    id: "improve-test-coverage",
    label: "Improve test coverage",
    shortDescription: "Add tests for recent changes",
    prompt:
      "Find the most recently modified function or component that lacks tests and write a comprehensive test for it. Use the existing testing framework and verify the test passes.",
    icon: "test-tube",
  },
  {
    id: "find-bugs-todos",
    label: "Find potential bugs and TODOs",
    shortDescription: "Review code for issues",
    prompt:
      "Check the most recently modified files one by one for TODO comments, FIXME notes, or potential bugs (like missing error handling, null checks, or type safety issues). Stop when you find the first issue and fix it.",
    icon: "bug",
  },
  {
    id: "generate-docs",
    label: "Generate documentation",
    shortDescription: "Add JSDoc comments",
    prompt:
      "Add comprehensive JSDoc comments to undocumented functions in the most recently modified files",
    icon: "book-open",
  },
  {
    id: "optimize-performance",
    label: "Optimize performance",
    shortDescription: "Find and fix slow code",
    prompt:
      "Profile the application and optimize the slowest functions or components. Look for unnecessary re-renders, inefficient algorithms, or missing memoization.",
    icon: "zap",
  },
  {
    id: "security-audit",
    label: "Security audit",
    shortDescription: "Check for vulnerabilities",
    prompt:
      "Audit the codebase for security vulnerabilities like XSS, SQL injection, exposed secrets, or insecure dependencies. Focus on user input handling and authentication.",
    icon: "shield",
  },
];

const CLAUDE_UPDATE_TASK: RecommendedTask = {
  id: "update-claude-md",
  label: "Update CLAUDE.md",
  shortDescription: "Refresh documentation",
  prompt:
    "Update the CLAUDE.md file to reflect the current state of the codebase. This includes updating the codebase description, the codebase structure, and the codebase dependencies.",
  icon: "file-text",
};

const OTHER_AGENTS_UPDATE_TASK: RecommendedTask = {
  id: "update-agents-md",
  label: "Update AGENTS.md",
  shortDescription: "Refresh documentation",
  prompt:
    "Update the AGENTS.md file to reflect the current state of the codebase. This includes updating the codebase description, the codebase structure, and the codebase dependencies.",
  icon: "file-text",
};

/**
 * Returns the appropriate task recommendations based on the AI model.
 * Claude models get CLAUDE.md task, all other agents get AGENTS.md task.
 * The other tasks are common to both model types.
 */
export function tasksForModel(model: AIModel | undefined): RecommendedTask[] {
  const updateTask =
    model && modelToAgent(model) === "claudeCode"
      ? CLAUDE_UPDATE_TASK
      : OTHER_AGENTS_UPDATE_TASK;

  return [updateTask, ...COMMON_RECOMMENDED_TASKS];
}
