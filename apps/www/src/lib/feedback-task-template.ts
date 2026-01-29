import type { PRFeedback } from "@terragon/shared/db/types";

interface TemplateOptions {
  includeMergeInstructions: boolean;
}

/**
 * Generates a task description for addressing PR feedback
 */
export function generateFeedbackTaskDescription(
  feedback: PRFeedback,
  options: TemplateOptions,
): string {
  const sections: string[] = [];

  // PR Context
  sections.push(`PR: ${feedback.prUrl}`);
  sections.push(`Branch: ${feedback.headBranch} → ${feedback.baseBranch}`);
  sections.push("");

  // Unresolved Comments
  const unresolvedThreads = feedback.comments.unresolved;
  if (unresolvedThreads.length > 0) {
    const totalComments = unresolvedThreads.reduce(
      (acc, t) => acc + t.comments.length,
      0,
    );
    sections.push(`## PR Comments (${totalComments} unresolved)`);
    sections.push("");

    for (const thread of unresolvedThreads) {
      const firstComment = thread.comments[0];
      if (!firstComment) continue;

      const location = firstComment.line
        ? `${firstComment.path}:${firstComment.line}`
        : firstComment.path;

      // Truncate long comments
      const body =
        firstComment.body.length > 200
          ? firstComment.body.substring(0, 200) + "..."
          : firstComment.body;

      sections.push(`- **${location}** (@${firstComment.author.login})`);
      sections.push(`  ${body.split("\n").join("\n  ")}`);

      // Show if there are replies
      if (thread.comments.length > 1) {
        sections.push(
          `  _${thread.comments.length - 1} ${thread.comments.length === 2 ? "reply" : "replies"}_`,
        );
      }
      sections.push("");
    }
  }

  // Failing Checks
  const failingChecks = feedback.checks.filter(
    (c) =>
      c.conclusion === "failure" ||
      c.conclusion === "timed_out" ||
      c.conclusion === "cancelled",
  );

  if (failingChecks.length > 0) {
    sections.push(`## Failing Checks (${failingChecks.length})`);
    sections.push("");

    for (const check of failingChecks) {
      const status =
        check.conclusion === "failure"
          ? "❌"
          : check.conclusion === "timed_out"
            ? "⏱️"
            : "⚪";
      sections.push(`- ${status} **${check.name}**`);
      if (check.output?.summary) {
        const summary =
          check.output.summary.length > 150
            ? check.output.summary.substring(0, 150) + "..."
            : check.output.summary;
        sections.push(`  ${summary}`);
      }
      if (check.detailsUrl) {
        sections.push(`  Details: ${check.detailsUrl}`);
      }
    }
    sections.push("");
  }

  // Coverage
  if (feedback.coverageCheck) {
    const coverageStatus =
      feedback.coverageCheck.conclusion === "success"
        ? "✅ Passing"
        : feedback.coverageCheck.conclusion === "failure"
          ? "❌ Failing"
          : "⏳ Pending";

    sections.push(`## Coverage`);
    sections.push("");
    sections.push(`Status: ${coverageStatus}`);
    if (feedback.coverageCheck.output?.summary) {
      sections.push(feedback.coverageCheck.output.summary);
    }
    sections.push("");
  }

  // Merge Conflicts
  if (feedback.hasConflicts) {
    sections.push(`## ⚠️ Merge Conflicts`);
    sections.push("");
    sections.push(
      `This PR has merge conflicts with \`${feedback.baseBranch}\` that must be resolved.`,
    );
    sections.push("");
    sections.push("To resolve:");
    sections.push("1. Pull latest changes from the base branch");
    sections.push("2. Merge or rebase onto the base branch");
    sections.push("3. Resolve conflicts in affected files");
    sections.push("4. Commit and push the resolved changes");
    sections.push("");
  }

  // Instructions
  sections.push("## Instructions");
  sections.push("");
  sections.push("Please address the above feedback:");

  const tasks: string[] = [];

  if (unresolvedThreads.length > 0) {
    tasks.push("- Review and address each PR comment");
  }
  if (failingChecks.length > 0) {
    tasks.push("- Fix the failing CI checks");
  }
  if (feedback.coverageCheck?.conclusion === "failure") {
    tasks.push("- Improve test coverage to meet requirements");
  }
  if (feedback.hasConflicts) {
    tasks.push("- Resolve merge conflicts with the base branch");
  }

  sections.push(tasks.join("\n"));
  sections.push("");

  // Merge instructions
  if (options.includeMergeInstructions) {
    sections.push("## After Addressing Feedback");
    sections.push("");
    sections.push(
      "Once all comments are addressed and checks pass, merge the PR.",
    );
    if (!feedback.hasConflicts && feedback.isMergeable) {
      sections.push(
        "The PR is currently mergeable - you can merge once feedback is addressed.",
      );
    }
  }

  return sections.join("\n");
}

/**
 * Creates a short summary of feedback for display
 */
export function createFeedbackSummaryText(feedback: PRFeedback): string {
  const parts: string[] = [];

  const unresolvedCount = feedback.comments.unresolved.reduce(
    (acc, t) => acc + t.comments.length,
    0,
  );
  if (unresolvedCount > 0) {
    parts.push(`${unresolvedCount} comment${unresolvedCount === 1 ? "" : "s"}`);
  }

  const failingCount = feedback.checks.filter(
    (c) => c.conclusion === "failure" || c.conclusion === "timed_out",
  ).length;
  if (failingCount > 0) {
    parts.push(`${failingCount} failing check${failingCount === 1 ? "" : "s"}`);
  }

  if (feedback.hasConflicts) {
    parts.push("merge conflicts");
  }

  if (parts.length === 0) {
    return "No issues found";
  }

  return parts.join(", ");
}
