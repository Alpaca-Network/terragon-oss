import { db } from "@/lib/db";
import { getOctokitForUserOrThrow, parseRepoFullName } from "@/lib/github";
import { getThreadMinimal } from "@terragon/shared/model/threads";
import { getPostHogServer } from "@/lib/posthog-server";
import type { MergeMethod } from "@/server-actions/merge-pr";

/**
 * Maps our merge method to GitHub's GraphQL PullRequestMergeMethod enum
 */
function toGraphQLMergeMethod(
  mergeMethod: MergeMethod,
): "MERGE" | "SQUASH" | "REBASE" {
  switch (mergeMethod) {
    case "merge":
      return "MERGE";
    case "squash":
      return "SQUASH";
    case "rebase":
      return "REBASE";
    default:
      return "SQUASH";
  }
}

/**
 * Enables auto-merge on a PR if the thread has autoMergePR enabled.
 * This is called when a task completes successfully and has an associated PR.
 */
export async function maybeEnableAutoMerge({
  threadId,
  userId,
}: {
  threadId: string;
  userId: string;
}): Promise<{ enabled: boolean; reason: string }> {
  // Get thread to check if auto-merge is enabled
  const thread = await getThreadMinimal({ db, threadId, userId });
  if (!thread) {
    return { enabled: false, reason: "Thread not found" };
  }

  // Check if auto-merge is enabled for this thread
  if (!thread.autoMergePR) {
    return { enabled: false, reason: "Auto-merge PR is not enabled" };
  }

  // Check if thread has an associated PR
  if (!thread.githubPRNumber) {
    return { enabled: false, reason: "Thread does not have an associated PR" };
  }

  const repoFullName = thread.githubRepoFullName;
  const prNumber = thread.githubPRNumber;
  const [owner, repo] = parseRepoFullName(repoFullName);

  try {
    const octokit = await getOctokitForUserOrThrow({ userId });

    // Get PR details to check current state
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Don't enable if PR is already merged
    if (pr.merged) {
      return { enabled: false, reason: "PR is already merged" };
    }

    // Don't enable if PR is closed
    if (pr.state === "closed") {
      return { enabled: false, reason: "PR is closed" };
    }

    // Check if auto-merge is already enabled
    if (pr.auto_merge) {
      return { enabled: true, reason: "Auto-merge is already enabled" };
    }

    // Enable auto-merge using GraphQL
    const mergeMethod: MergeMethod = "squash";
    const graphqlMergeMethod = toGraphQLMergeMethod(mergeMethod);

    await octokit.graphql(
      `mutation EnableAutoMerge($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
        enablePullRequestAutoMerge(input: {
          pullRequestId: $pullRequestId,
          mergeMethod: $mergeMethod
        }) {
          pullRequest {
            id
            autoMergeRequest {
              enabledAt
              mergeMethod
            }
          }
        }
      }`,
      {
        pullRequestId: pr.node_id,
        mergeMethod: graphqlMergeMethod,
      },
    );

    // Track the auto-merge enable in PostHog
    getPostHogServer().capture({
      distinctId: userId,
      event: "auto_merge_enabled_on_task_complete",
      properties: {
        threadId,
        repoFullName,
        prNumber,
        mergeMethod,
      },
    });

    console.log(
      `Auto-merge enabled for PR #${prNumber} in ${repoFullName} (thread ${threadId})`,
    );

    return { enabled: true, reason: "Auto-merge enabled successfully" };
  } catch (error: any) {
    // Handle known GitHub API errors
    if (error.status === 404) {
      console.error(
        `PR #${prNumber} not found in ${repoFullName} when enabling auto-merge`,
      );
      return { enabled: false, reason: `PR #${prNumber} not found` };
    }

    // GraphQL errors are returned differently
    if (error.errors?.length > 0) {
      const errorMessage = error.errors[0].message;

      // Log known errors but don't throw - auto-merge is a best-effort feature
      if (
        errorMessage.includes("not authorized") ||
        errorMessage.includes("Auto-merge is not allowed") ||
        errorMessage.includes("auto-merge is not enabled") ||
        errorMessage.includes("protected branch") ||
        errorMessage.includes("unstable status")
      ) {
        console.log(
          `Could not enable auto-merge for PR #${prNumber}: ${errorMessage}`,
        );
        return { enabled: false, reason: errorMessage };
      }

      console.error(
        `Failed to enable auto-merge for PR #${prNumber}: ${errorMessage}`,
      );
      return { enabled: false, reason: errorMessage };
    }

    console.error(
      `Failed to enable auto-merge for PR #${prNumber}:`,
      error.message,
    );
    return { enabled: false, reason: error.message };
  }
}
