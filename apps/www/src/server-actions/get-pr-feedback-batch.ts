"use server";

import { cache } from "react";
import { userOnlyAction } from "@/lib/auth-server";
import { getOctokitForApp, parseRepoFullName } from "@/lib/github";
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

export type ThreadPRInfo = {
  id: string;
  githubPRNumber: number | null;
  githubRepoFullName: string;
  autoFixQueuedAt?: Date | null;
};

/**
 * Batch fetches PR feedback for multiple threads in parallel
 * This is more efficient than making individual requests for each thread
 *
 * Note: This function takes thread PR info directly to avoid redundant database
 * queries - the caller already has this info from the thread list fetch.
 */
export const getPRFeedbackBatch = cache(
  userOnlyAction(
    async function getPRFeedbackBatch(
      _userId: string,
      threadPRInfos: ThreadPRInfo[],
    ): Promise<BatchPRFeedbackResult> {
      if (threadPRInfos.length === 0) {
        return {};
      }

      // Limit batch size to prevent overwhelming GitHub API
      const MAX_BATCH_SIZE = 10;
      const limitedThreads = threadPRInfos.slice(0, MAX_BATCH_SIZE);

      // Filter threads that have PRs
      const threadsWithPRs = limitedThreads.filter(
        (thread): thread is ThreadPRInfo & { githubPRNumber: number } =>
          thread.githubPRNumber !== null && !!thread.githubRepoFullName,
      );

      // Fetch PR feedback in parallel for all threads with PRs
      // Using Promise.all with try/catch inside each promise to handle errors gracefully
      const feedbackResults = await Promise.all(
        threadsWithPRs.map(async (thread) => {
          try {
            const [owner, repo] = parseRepoFullName(thread.githubRepoFullName);
            const octokit = await getOctokitForApp({ owner, repo });
            const feedback = await aggregatePRFeedback(
              octokit,
              owner,
              repo,
              thread.githubPRNumber,
              { autoFixQueuedAt: thread.autoFixQueuedAt ?? null },
            );
            const summary = createFeedbackSummary(feedback);
            return { threadId: thread.id, feedback, summary, error: null };
          } catch (error) {
            // Log error but continue with other threads
            console.error(
              `Failed to fetch PR feedback for thread ${thread.id}:`,
              error,
            );
            return {
              threadId: thread.id,
              feedback: null,
              summary: null,
              error,
            };
          }
        }),
      );

      // Build result map
      const result: BatchPRFeedbackResult = {};

      // Initialize all requested thread IDs with null (no PR or not found)
      for (const thread of limitedThreads) {
        result[thread.id] = null;
      }

      // Fill in successful results
      for (const feedbackResult of feedbackResults) {
        const { threadId, feedback, summary } = feedbackResult;
        if (feedback && summary) {
          result[threadId] = { feedback, summary };
        }
      }

      return result;
    },
    { defaultErrorMessage: "Failed to fetch PR feedback batch" },
  ),
);
