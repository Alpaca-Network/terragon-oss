"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  getOctokitForApp,
  parseRepoFullName,
  updateGitHubPR,
} from "@/lib/github";
import { fetchPRWithMergeablePolling } from "@/lib/github-pulls";
import { getThreadMinimal } from "@terragon/shared/model/threads";
import { UserFacingError } from "@/lib/server-actions";
import { getPostHogServer } from "@/lib/posthog-server";

export type MergeMethod = "merge" | "squash" | "rebase";

type MergePRParams = {
  repoFullName: string;
  prNumber: number;
  mergeMethod?: MergeMethod;
  commitTitle?: string;
  commitMessage?: string;
  threadId?: string; // Optional: to update thread after merge
};

type MergePRResult = {
  success: boolean;
  merged: boolean;
  sha?: string;
  message: string;
};

type PRGetResponse = Awaited<
  ReturnType<
    Awaited<ReturnType<typeof getOctokitForApp>>["rest"]["pulls"]["get"]
  >
>["data"];

/**
 * Merges a PR on GitHub
 */
export const mergePR = userOnlyAction(
  async function mergePR(
    userId: string,
    params: MergePRParams,
  ): Promise<MergePRResult> {
    const {
      repoFullName,
      prNumber,
      mergeMethod = "squash",
      commitTitle,
      commitMessage,
      threadId,
    } = params;

    const [owner, repo] = parseRepoFullName(repoFullName);

    try {
      const octokit = await getOctokitForApp({ owner, repo });

      // First check if PR is mergeable
      const pr = await fetchPRWithMergeablePolling({
        octokit,
        owner,
        repo,
        prNumber,
      });

      if (pr.merged) {
        return {
          success: true,
          merged: true,
          sha: pr.merge_commit_sha ?? undefined,
          message: "PR was already merged",
        };
      }

      if (pr.state === "closed") {
        throw new UserFacingError("Cannot merge a closed PR");
      }

      if (!pr.mergeable) {
        if (pr.mergeable_state === "dirty") {
          throw new UserFacingError(
            "PR has merge conflicts that must be resolved first",
          );
        }
        if (pr.mergeable_state === "blocked") {
          throw new UserFacingError(
            "PR is blocked by branch protection rules or required checks",
          );
        }
        throw new UserFacingError(
          `PR is not mergeable (state: ${pr.mergeable_state})`,
        );
      }

      // Attempt to merge
      const { data: mergeResult } = await octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: prNumber,
        merge_method: mergeMethod,
        commit_title: commitTitle,
        commit_message: commitMessage,
      });

      // Track the merge in PostHog
      getPostHogServer().capture({
        distinctId: userId,
        event: "pr_merged",
        properties: {
          repoFullName,
          prNumber,
          mergeMethod,
          threadId,
        },
      });

      // Update the PR status in our database
      await updateGitHubPR({
        repoFullName,
        prNumber,
        createIfNotFound: false,
      });

      // If a thread was provided, archive it (if user has that setting)
      if (threadId) {
        try {
          const thread = await getThreadMinimal({ db, userId, threadId });
          if (thread && !thread.archived) {
            // The updateGitHubPR function already handles auto-archiving
            // based on user settings, but we trigger the update here
          }
        } catch (error) {
          console.error("Failed to update thread after merge:", error);
        }
      }

      return {
        success: true,
        merged: mergeResult.merged,
        sha: mergeResult.sha,
        message: mergeResult.message,
      };
    } catch (error: any) {
      // Handle known GitHub API errors
      if (error.status === 404) {
        throw new UserFacingError(
          `PR #${prNumber} not found in ${repoFullName}`,
        );
      }
      if (error.status === 405) {
        throw new UserFacingError(
          "PR cannot be merged. Check if all required checks have passed.",
        );
      }
      if (error.status === 409) {
        throw new UserFacingError(
          "PR has a merge conflict or head branch was modified. Please refresh and try again.",
        );
      }

      // Re-throw UserFacingErrors as-is
      if (error instanceof UserFacingError) {
        throw error;
      }

      throw new UserFacingError(`Failed to merge PR: ${error.message}`);
    }
  },
  { defaultErrorMessage: "Failed to merge PR" },
);

/**
 * Checks if a PR can be merged
 */
export const canMergePR = userOnlyAction(
  async function canMergePR(
    userId: string,
    params: { repoFullName: string; prNumber: number },
  ): Promise<{
    canMerge: boolean;
    reason?: string;
    mergeableState: string;
  }> {
    const { repoFullName, prNumber } = params;
    const [owner, repo] = parseRepoFullName(repoFullName);

    try {
      const octokit = await getOctokitForApp({ owner, repo });
      const pr = await fetchPRWithMergeablePolling({
        octokit,
        owner,
        repo,
        prNumber,
      });

      if (pr.merged) {
        return {
          canMerge: false,
          reason: "PR is already merged",
          mergeableState: "merged",
        };
      }

      if (pr.state === "closed") {
        return {
          canMerge: false,
          reason: "PR is closed",
          mergeableState: "closed",
        };
      }

      if (!pr.mergeable) {
        let reason = "PR is not mergeable";
        if (pr.mergeable_state === "dirty") {
          reason = "PR has merge conflicts";
        } else if (pr.mergeable_state === "blocked") {
          reason = "PR is blocked by branch protection rules";
        } else if (pr.mergeable_state === "unstable") {
          reason = "PR has failing required checks";
        }
        return {
          canMerge: false,
          reason,
          mergeableState: pr.mergeable_state ?? "unknown",
        };
      }

      return {
        canMerge: true,
        mergeableState: pr.mergeable_state ?? "clean",
      };
    } catch (error: any) {
      if (error.status === 404) {
        throw new UserFacingError(
          `PR #${prNumber} not found in ${repoFullName}`,
        );
      }
      throw new UserFacingError(`Failed to check PR status: ${error.message}`);
    }
  },
  { defaultErrorMessage: "Failed to check PR merge status" },
);
