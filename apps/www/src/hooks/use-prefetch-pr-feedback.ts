"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ThreadInfo } from "@terragon/shared";
import { getPRFeedbackBatch } from "@/server-actions/get-pr-feedback-batch";

// Must match MAX_BATCH_SIZE in get-pr-feedback-batch.ts
const MAX_BATCH_SIZE = 10;

/**
 * Prefetches PR feedback for threads that have PRs and populates the React Query cache.
 * This allows individual PRFeedbackBadge components to use the cached data
 * instead of making separate requests.
 */
export function usePrefetchPRFeedback(threads: ThreadInfo[]) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Find threads with PRs that haven't been prefetched yet
    const threadsWithPRs = threads.filter(
      (thread) =>
        thread.githubPRNumber !== null &&
        thread.githubRepoFullName &&
        !prefetchedRef.current.has(thread.id),
    );

    if (threadsWithPRs.length === 0) {
      return;
    }

    // Only take threads up to the batch limit to avoid marking threads
    // that won't actually be fetched
    const limitedThreads = threadsWithPRs.slice(0, MAX_BATCH_SIZE);
    const threadIds = limitedThreads.map((t) => t.id);

    // Mark only the threads we're actually fetching as prefetched
    for (const id of threadIds) {
      prefetchedRef.current.add(id);
    }

    // Batch fetch PR feedback
    const fetchBatch = async () => {
      try {
        const result = await getPRFeedbackBatch(threadIds);
        if (!result.success) {
          console.error(
            "Failed to batch fetch PR feedback:",
            result.errorMessage,
          );
          return;
        }

        const batchData = result.data;

        // Populate the React Query cache for each thread
        for (const threadId of threadIds) {
          const feedbackData = batchData[threadId];
          if (feedbackData) {
            // Use the same query key pattern as individual PR feedback queries
            queryClient.setQueryData(
              ["pr-feedback-summary", threadId],
              feedbackData,
            );
            // Also set for other query key variants used in the codebase
            queryClient.setQueryData(["pr-feedback", threadId], feedbackData);
            queryClient.setQueryData(
              ["pr-feedback-indicators", threadId],
              feedbackData,
            );
            queryClient.setQueryData(
              ["pr-feedback-kanban", threadId],
              feedbackData,
            );
          }
        }
      } catch (error) {
        console.error("Error prefetching PR feedback batch:", error);
        // Remove failed thread IDs from prefetched set so they can be retried
        for (const id of threadIds) {
          prefetchedRef.current.delete(id);
        }
      }
    };

    fetchBatch();
  }, [threads, queryClient]);
}
