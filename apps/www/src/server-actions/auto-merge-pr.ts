"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { getOctokitForUserOrThrow, parseRepoFullName } from "@/lib/github";
import { getPostHogServer } from "@/lib/posthog-server";
import { UserFacingError } from "@/lib/server-actions";
import type { MergeMethod } from "./merge-pr";

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

type EnableAutoMergeParams = {
  repoFullName: string;
  prNumber: number;
  mergeMethod?: MergeMethod;
};

type EnableAutoMergeResult = {
  success: boolean;
  message: string;
};

/**
 * Enables auto-merge on a PR. The PR will be automatically merged when:
 * - All required checks pass
 * - All review requirements are satisfied
 * - There are no merge conflicts
 *
 * Note: Auto-merge must be enabled in the repository settings for this to work.
 */
export const enableAutoMerge = userOnlyAction(
  async function enableAutoMerge(
    userId: string,
    params: EnableAutoMergeParams,
  ): Promise<EnableAutoMergeResult> {
    const { repoFullName, prNumber, mergeMethod = "squash" } = params;

    const [owner, repo] = parseRepoFullName(repoFullName);

    try {
      const octokit = await getOctokitForUserOrThrow({ userId });

      // First, get the PR's node ID using REST API
      const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      if (pr.merged) {
        return {
          success: false,
          message: "PR is already merged",
        };
      }

      if (pr.state === "closed") {
        throw new UserFacingError("Cannot enable auto-merge on a closed PR");
      }

      // Check if auto-merge is already enabled
      if (pr.auto_merge) {
        return {
          success: true,
          message: "Auto-merge is already enabled",
        };
      }

      // Use GraphQL to enable auto-merge
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
        event: "pr_auto_merge_enabled",
        properties: {
          repoFullName,
          prNumber,
          mergeMethod,
        },
      });

      return {
        success: true,
        message: "Auto-merge enabled successfully",
      };
    } catch (error: any) {
      // Handle known GitHub API errors
      if (error.status === 404) {
        throw new UserFacingError(
          `PR #${prNumber} not found in ${repoFullName}`,
        );
      }

      // GraphQL errors are returned differently
      if (error.errors?.length > 0) {
        const errorMessage = error.errors[0].message;

        // Check for common auto-merge errors
        if (errorMessage.includes("not authorized")) {
          throw new UserFacingError(
            "You are not authorized to enable auto-merge on this PR. Check branch protection settings.",
          );
        }
        if (
          errorMessage.includes("Auto-merge is not allowed") ||
          errorMessage.includes("auto-merge is not enabled")
        ) {
          throw new UserFacingError(
            "Auto-merge is not enabled for this repository. Enable it in repository settings.",
          );
        }
        if (errorMessage.includes("protected branch")) {
          throw new UserFacingError(
            "Cannot enable auto-merge due to branch protection rules.",
          );
        }

        throw new UserFacingError(
          `Failed to enable auto-merge: ${errorMessage}`,
        );
      }

      // Re-throw UserFacingErrors as-is
      if (error instanceof UserFacingError) {
        throw error;
      }

      throw new UserFacingError(
        `Failed to enable auto-merge: ${error.message}`,
      );
    }
  },
  { defaultErrorMessage: "Failed to enable auto-merge" },
);

type DisableAutoMergeParams = {
  repoFullName: string;
  prNumber: number;
};

type DisableAutoMergeResult = {
  success: boolean;
  message: string;
};

/**
 * Disables auto-merge on a PR
 */
export const disableAutoMerge = userOnlyAction(
  async function disableAutoMerge(
    userId: string,
    params: DisableAutoMergeParams,
  ): Promise<DisableAutoMergeResult> {
    const { repoFullName, prNumber } = params;

    const [owner, repo] = parseRepoFullName(repoFullName);

    try {
      const octokit = await getOctokitForUserOrThrow({ userId });

      // First, get the PR's node ID using REST API
      const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      if (pr.merged) {
        return {
          success: false,
          message: "PR is already merged",
        };
      }

      // Check if auto-merge is not enabled
      if (!pr.auto_merge) {
        return {
          success: true,
          message: "Auto-merge is not enabled",
        };
      }

      // Use GraphQL to disable auto-merge
      await octokit.graphql(
        `mutation DisableAutoMerge($pullRequestId: ID!) {
          disablePullRequestAutoMerge(input: {
            pullRequestId: $pullRequestId
          }) {
            pullRequest {
              id
              autoMergeRequest {
                enabledAt
              }
            }
          }
        }`,
        {
          pullRequestId: pr.node_id,
        },
      );

      // Track the auto-merge disable in PostHog
      getPostHogServer().capture({
        distinctId: userId,
        event: "pr_auto_merge_disabled",
        properties: {
          repoFullName,
          prNumber,
        },
      });

      return {
        success: true,
        message: "Auto-merge disabled successfully",
      };
    } catch (error: any) {
      // Handle known GitHub API errors
      if (error.status === 404) {
        throw new UserFacingError(
          `PR #${prNumber} not found in ${repoFullName}`,
        );
      }

      // GraphQL errors are returned differently
      if (error.errors?.length > 0) {
        const errorMessage = error.errors[0].message;
        throw new UserFacingError(
          `Failed to disable auto-merge: ${errorMessage}`,
        );
      }

      // Re-throw UserFacingErrors as-is
      if (error instanceof UserFacingError) {
        throw error;
      }

      throw new UserFacingError(
        `Failed to disable auto-merge: ${error.message}`,
      );
    }
  },
  { defaultErrorMessage: "Failed to disable auto-merge" },
);
