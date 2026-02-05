"use server";

import { cache } from "react";
import { userOnlyAction } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { getOctokitForApp, parseRepoFullName } from "@/lib/github";
import { getThreadMinimal } from "@terragon/shared/model/threads";
import {
  aggregatePRFeedback,
  createFeedbackSummary,
} from "@terragon/shared/github/pr-feedback";
import type { PRFeedback, PRFeedbackSummary } from "@terragon/shared/db/types";
import { UserFacingError } from "@/lib/server-actions";

type GetPRFeedbackParams =
  | { threadId: string }
  | { repoFullName: string; prNumber: number };

export type GetPRFeedbackResult = {
  feedback: PRFeedback;
  summary: PRFeedbackSummary;
};

/**
 * Fetches PR feedback for a thread or specific PR
 */
export const getPRFeedback = cache(
  userOnlyAction(
    async function getPRFeedback(
      userId: string,
      params: GetPRFeedbackParams,
    ): Promise<GetPRFeedbackResult> {
      let repoFullName: string;
      let prNumber: number;

      // Track feedbackQueuedAt from thread if available
      let feedbackQueuedAt: Date | null = null;

      if ("threadId" in params) {
        // Get PR info from thread
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
        const feedback = await aggregatePRFeedback(
          octokit,
          owner,
          repo,
          prNumber,
          { feedbackQueuedAt },
        );
        const summary = createFeedbackSummary(feedback);

        return { feedback, summary };
      } catch (error: any) {
        if (error.status === 404) {
          throw new UserFacingError(
            `PR #${prNumber} not found in ${repoFullName}`,
          );
        }
        throw new UserFacingError(
          `Failed to fetch PR feedback: ${error.message}`,
        );
      }
    },
    { defaultErrorMessage: "Failed to fetch PR feedback" },
  ),
);

/**
 * Fetches just the PR feedback summary (lighter weight for task lists)
 */
export const getPRFeedbackSummary = cache(
  userOnlyAction(
    async function getPRFeedbackSummary(
      userId: string,
      params: GetPRFeedbackParams,
    ): Promise<PRFeedbackSummary> {
      // Call the wrapped getPRFeedback which only takes params
      const result = await getPRFeedback(params);
      if (!result.success) {
        throw new Error(result.errorMessage);
      }
      return result.data.summary;
    },
    { defaultErrorMessage: "Failed to fetch PR feedback summary" },
  ),
);
