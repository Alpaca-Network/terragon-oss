"use server";

import { cache } from "react";
import { userOnlyAction } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { getOctokitForApp, parseRepoFullName } from "@/lib/github";
import { getThreadMinimal } from "@terragon/shared/model/threads";
import { aggregatePRComments } from "@terragon/shared/github/pr-feedback";
import type { PRCommentsData } from "@terragon/shared/db/types";
import { UserFacingError } from "@/lib/server-actions";

type GetPRCommentsParams =
  | { threadId: string }
  | { repoFullName: string; prNumber: number };

export type GetPRCommentsResult = PRCommentsData;

/**
 * Fetches PR comments with resolution status.
 * This is one of the tab-specific queries for progressive loading.
 */
export const getPRComments = cache(
  userOnlyAction(
    async function getPRComments(
      userId: string,
      params: GetPRCommentsParams,
    ): Promise<GetPRCommentsResult> {
      let repoFullName: string;
      let prNumber: number;

      // Track feedbackQueuedAt from thread if available
      let feedbackQueuedAt: Date | null = null;

      if ("threadId" in params) {
        const thread = await getThreadMinimal({
          db,
          userId,
          threadId: params.threadId,
        });

        if (!thread) {
          throw new UserFacingError("Task not found");
        }

        if (!thread.githubPRNumber) {
          throw new UserFacingError("This task does not have an associated PR");
        }

        repoFullName = thread.githubRepoFullName;
        prNumber = thread.githubPRNumber;
        feedbackQueuedAt = thread.feedbackQueuedAt ?? null;
      } else {
        repoFullName = params.repoFullName;
        prNumber = params.prNumber;
      }

      const [owner, repo] = parseRepoFullName(repoFullName);

      try {
        const octokit = await getOctokitForApp({ owner, repo });
        return await aggregatePRComments(octokit, owner, repo, prNumber, {
          feedbackQueuedAt,
        });
      } catch (error: any) {
        if (error.status === 404) {
          throw new UserFacingError(
            `PR #${prNumber} not found in ${repoFullName}`,
          );
        }
        throw new UserFacingError(
          `Failed to fetch PR comments: ${error.message}`,
        );
      }
    },
    { defaultErrorMessage: "Failed to fetch PR comments" },
  ),
);
