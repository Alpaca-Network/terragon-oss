"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  getOctokitForApp,
  parseRepoFullName,
  updateGitHubPR,
} from "@/lib/github";
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

const MERGEABLE_STATE_POLL_ATTEMPTS = 5;
const MERGEABLE_STATE_POLL_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGithubError(error: unknown) {
  const status = (error as { status?: number }).status;
  if (status === 401 || status === 403 || status === 404 || status === 422) {
    return false;
  }
  return true;
}

type PRGetResponse = Awaited<
  ReturnType<
    Awaited<ReturnType<typeof getOctokitForApp>>["rest"]["pulls"]["get"]
  >
>["data"];

async function fetchPRWithMergeablePolling({
  octokit,
  owner,
  repo,
  prNumber,
}: {
  octokit: Awaited<ReturnType<typeof getOctokitForApp>>;
  owner: string;
  repo: string;
  prNumber: number;
}): Promise<PRGetResponse> {
  let lastData: PRGetResponse | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MERGEABLE_STATE_POLL_ATTEMPTS; attempt += 1) {
    try {
      const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });
      lastData = data;
      lastError = null;

      const isComputingMergeableState =
        data.mergeable_state == null && data.mergeable == null;

      if (!isComputingMergeableState) {
        return data;
      }

      if (attempt < MERGEABLE_STATE_POLL_ATTEMPTS - 1) {
        await sleep(MERGEABLE_STATE_POLL_DELAY_MS);
      }
    } catch (error) {
      lastError = error as Error;
      if (!isRetryableGithubError(error)) {
        throw error;
      }
      if (attempt < MERGEABLE_STATE_POLL_ATTEMPTS - 1) {
        await sleep(MERGEABLE_STATE_POLL_DELAY_MS);
      }
    }
  }

  if (lastData === null) {
    throw lastError ?? new Error("Failed to fetch PR data after all attempts");
  }

  return lastData;
}

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
