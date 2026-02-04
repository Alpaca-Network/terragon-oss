"use client";

import { useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ThreadInfo } from "@terragon/shared";
import { threadQueryOptions } from "@/queries/thread-queries";
import { startMetric, endMetric } from "@/lib/performance-metrics";

// Maximum number of threads to prefetch at once
// Increased from 5 to 8 for better mobile coverage
// Mobile kanban typically shows 3-5 tasks per column, so 8 covers most visible content
export const MAX_PREFETCH_COUNT = 8;

/**
 * Prefetches thread detail data for visible threads and populates the React Query cache.
 * This allows the KanbanTaskDrawer to use cached data instead of making a cold fetch
 * when the user taps a task on mobile.
 */
export function usePrefetchThreads(threads: ThreadInfo[]) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef<Set<string>>(new Set());

  // Create a stable dependency based on thread IDs to avoid re-running effect
  // when array identity changes but content is the same
  const threadIds = useMemo(
    () => threads.map((t) => t.id).join(","),
    [threads],
  );

  useEffect(() => {
    // Find threads that haven't been prefetched yet
    const threadsToPrefetch = threads.filter(
      (thread) => !prefetchedRef.current.has(thread.id),
    );

    if (threadsToPrefetch.length === 0) {
      return;
    }

    // Limit prefetch count to avoid over-fetching
    const limitedThreads = threadsToPrefetch.slice(0, MAX_PREFETCH_COUNT);

    // Mark threads as prefetched before starting (prevents duplicate requests)
    for (const thread of limitedThreads) {
      prefetchedRef.current.add(thread.id);
    }

    // Prefetch each thread's detail data with performance tracking
    const batchMetricKey = startMetric("prefetch_threads_batch", undefined, {
      count: limitedThreads.length,
    });

    let completedCount = 0;
    for (const thread of limitedThreads) {
      const metricKey = startMetric("prefetch_thread", thread.id);
      queryClient
        .prefetchQuery(threadQueryOptions(thread.id))
        .then(() => {
          endMetric(metricKey, { success: true });
        })
        .catch((error) => {
          console.error(`Error prefetching thread ${thread.id}:`, error);
          endMetric(metricKey, { success: false });
          // Remove from prefetched set so it can be retried
          prefetchedRef.current.delete(thread.id);
        })
        .finally(() => {
          completedCount++;
          if (completedCount === limitedThreads.length) {
            endMetric(batchMetricKey, { completedCount });
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- using threadIds for stable comparison
  }, [threadIds, queryClient]);
}

/**
 * Hook to get a prefetch function for a single thread.
 * Use this for on-demand prefetching (e.g., on hover or touch).
 */
export function usePrefetchThread() {
  const queryClient = useQueryClient();

  return (threadId: string) => {
    const metricKey = startMetric("prefetch_thread", threadId);
    queryClient
      .prefetchQuery(threadQueryOptions(threadId))
      .then(() => {
        endMetric(metricKey, { success: true, source: "hover" });
      })
      .catch((error) => {
        // Silently handle prefetch errors - prefetching is an optimization,
        // the actual fetch will happen when the drawer opens if this fails
        console.error(`Error prefetching thread ${threadId}:`, error);
        endMetric(metricKey, { success: false, source: "hover" });
      });
  };
}
