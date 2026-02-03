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

export type BatchPRFeedbackResult = {
  [threadId: string]: {
    feedback: PRFeedback;
    summary: PRFeedbackSummary;
  } | null;
};

/**
 * Batch fetches PR feedback for multiple threads in parallel
 * This is more efficient than making individual requests for each thread
 */
export const getPRFeedbackBatch = cache(
  userOnlyAction(
    async function getPRFeedbackBatch(
      userId: string,
      threadIds: string[],
    ): Promise<BatchPRFeedbackResult> {
      if (threadIds.length === 0) {
        return {};
      }

      // Limit batch size to prevent overwhelming GitHub API
      const MAX_BATCH_SIZE = 10;
      const limitedThreadIds = threadIds.slice(0, MAX_BATCH_SIZE);

      // Fetch all threads in parallel to get PR info
      const threads = await Promise.all(
        limitedThreadIds.map((threadId) =>
          getThreadMinimal({ db, userId, threadId }),
        ),
      );

      // Filter threads that have PRs and group by repo
      const threadsWithPRs = threads
        .map((thread, index) => ({
          thread,
          threadId: limitedThreadIds[index]!,
        }))
        .filter(
          (
            item,
          ): item is {
            thread: NonNullable<typeof item.thread>;
            threadId: string;
          } => item.thread !== null && item.thread.githubPRNumber !== null,
        );

      // Fetch PR feedback in parallel for all threads with PRs
      const feedbackResults = await Promise.allSettled(
        threadsWithPRs.map(async ({ thread, threadId }) => {
          const [owner, repo] = parseRepoFullName(thread.githubRepoFullName);
          try {
            const octokit = await getOctokitForApp({ owner, repo });
            const feedback = await aggregatePRFeedback(
              octokit,
              owner,
              repo,
              thread.githubPRNumber!,
            );
            const summary = createFeedbackSummary(feedback);
            return { threadId, feedback, summary };
          } catch (error) {
            // Log error but continue with other threads
            console.error(
              `Failed to fetch PR feedback for thread ${threadId}:`,
              error,
            );
            return { threadId, error };
          }
        }),
      );

      // Build result map
      const result: BatchPRFeedbackResult = {};

      // Initialize all requested thread IDs with null (no PR or not found)
      for (const threadId of limitedThreadIds) {
        result[threadId] = null;
      }

      // Fill in successful results
      for (const settledResult of feedbackResults) {
        if (settledResult.status === "fulfilled") {
          const { threadId, feedback, summary } = settledResult.value;
          if (feedback && summary) {
            result[threadId] = { feedback, summary };
          }
        }
      }

      return result;
    },
    { defaultErrorMessage: "Failed to fetch PR feedback batch" },
  ),
);
