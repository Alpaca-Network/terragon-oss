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
      const feedbackResults = await Promise.allSettled(
        threadsWithPRs.map(async (thread) => {
          const [owner, repo] = parseRepoFullName(thread.githubRepoFullName);
          try {
            const octokit = await getOctokitForApp({ owner, repo });
            const feedback = await aggregatePRFeedback(
              octokit,
              owner,
              repo,
              thread.githubPRNumber,
            );
            const summary = createFeedbackSummary(feedback);
            return { threadId: thread.id, feedback, summary };
          } catch (error) {
            // Log error but continue with other threads
            console.error(
              `Failed to fetch PR feedback for thread ${thread.id}:`,
              error,
            );
            return { threadId: thread.id, error };
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
