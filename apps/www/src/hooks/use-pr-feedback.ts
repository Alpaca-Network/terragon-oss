"use client";

import { useMemo } from "react";
import { useServerActionQuery } from "@/queries/server-action-helpers";
import { getPRHeader, GetPRHeaderResult } from "@/server-actions/get-pr-header";
import {
  getPRComments,
  GetPRCommentsResult,
} from "@/server-actions/get-pr-comments";
import { getPRChecks, GetPRChecksResult } from "@/server-actions/get-pr-checks";
import type { PRFeedbackSummary } from "@terragon/shared/db/types";

export type UsePRFeedbackOptions = {
  /**
   * Whether the hook is enabled. Set to false to disable all queries.
   */
  enabled?: boolean;
  /**
   * Refresh key to force refetch. Increment to trigger a refresh.
   */
  refreshKey?: number;
  /**
   * Stale time for all queries in milliseconds. Default is 30000 (30 seconds).
   */
  staleTime?: number;
  /**
   * Refetch interval in milliseconds. Default is 60000 (60 seconds).
   */
  refetchInterval?: number;
};

export type UsePRFeedbackResult = {
  /**
   * Header query result - loads first, contains PR metadata
   */
  header: ReturnType<typeof useServerActionQuery<GetPRHeaderResult>>;
  /**
   * Comments query result - loads after header
   */
  comments: ReturnType<typeof useServerActionQuery<GetPRCommentsResult>>;
  /**
   * Checks query result - loads after header (requires headSha)
   */
  checks: ReturnType<typeof useServerActionQuery<GetPRChecksResult>>;
  /**
   * Combined summary from all queries for badge display
   */
  summary: PRFeedbackSummary | null;
  /**
   * True if header is still loading (first data to show)
   */
  isLoading: boolean;
  /**
   * True if all queries have successfully loaded
   */
  isFullyLoaded: boolean;
  /**
   * True if any query has an error
   */
  hasError: boolean;
};

/**
 * Hook for progressive loading of PR feedback data.
 *
 * This hook splits the PR feedback into three separate queries:
 * 1. Header - Fetches lightweight PR metadata first (title, branches, merge status)
 * 2. Comments - Fetches PR comments with resolution status
 * 3. Checks - Fetches check runs and coverage (requires headSha from header)
 *
 * This allows the UI to render progressively as data becomes available,
 * rather than waiting for all data to load before showing anything.
 *
 * @example
 * ```tsx
 * const { header, comments, checks, summary, isLoading } = usePRFeedback(threadId, {
 *   enabled: !!thread.githubPRNumber,
 * });
 *
 * if (isLoading) {
 *   return <HeaderSkeleton />;
 * }
 *
 * return (
 *   <div>
 *     <Header data={header.data} />
 *     {comments.isLoading ? <CommentsSkeleton /> : <Comments data={comments.data} />}
 *     {checks.isLoading ? <ChecksSkeleton /> : <Checks data={checks.data} />}
 *   </div>
 * );
 * ```
 */
export function usePRFeedback(
  threadId: string,
  options: UsePRFeedbackOptions = {},
): UsePRFeedbackResult {
  const {
    enabled = true,
    refreshKey = 0,
    staleTime = 30000,
    refetchInterval = 60000,
  } = options;

  // Query 1: Header - always fetches first when enabled
  const header = useServerActionQuery<GetPRHeaderResult>({
    queryKey: ["pr-header", threadId, refreshKey],
    queryFn: () => getPRHeader({ threadId }),
    enabled,
    staleTime,
    refetchInterval,
  });

  // Query 2: Comments - fetches when header is ready
  const comments = useServerActionQuery<GetPRCommentsResult>({
    queryKey: ["pr-comments", threadId, refreshKey],
    queryFn: () => getPRComments({ threadId }),
    enabled: enabled && header.isSuccess,
    staleTime,
    refetchInterval,
  });

  // Query 3: Checks - fetches when header is ready (needs headSha)
  // Always pass headSha from header to avoid redundant API calls in getPRChecks
  const checks = useServerActionQuery<GetPRChecksResult>({
    queryKey: ["pr-checks", threadId, header.data?.headSha, refreshKey],
    queryFn: () => getPRChecks({ threadId, headSha: header.data?.headSha }),
    enabled: enabled && header.isSuccess && !!header.data?.headSha,
    staleTime,
    refetchInterval,
  });

  // Compute combined summary for badge display
  const summary = useMemo<PRFeedbackSummary | null>(() => {
    if (!header.data) return null;

    return {
      unresolvedCommentCount: comments.data?.summary.unresolvedCount ?? 0,
      resolvedCommentCount: comments.data?.summary.resolvedCount ?? 0,
      failingCheckCount: checks.data?.summary.failingCount ?? 0,
      pendingCheckCount: checks.data?.summary.pendingCount ?? 0,
      passingCheckCount: checks.data?.summary.passingCount ?? 0,
      hasCoverageCheck: checks.data?.summary.hasCoverageCheck ?? false,
      coverageCheckPassed: checks.data?.summary.coverageCheckPassed ?? null,
      hasConflicts: header.data.hasConflicts,
      isMergeable: header.data.isMergeable,
    };
  }, [header.data, comments.data, checks.data]);

  return {
    header,
    comments,
    checks,
    summary,
    isLoading: header.isLoading,
    isFullyLoaded: header.isSuccess && comments.isSuccess && checks.isSuccess,
    hasError: header.isError || comments.isError || checks.isError,
  };
}

/**
 * Creates a combined PRFeedback object from the split queries.
 * Useful for components that need the full PRFeedback structure.
 */
export function combinePRFeedbackFromQueries(
  header: GetPRHeaderResult | undefined,
  comments: GetPRCommentsResult | undefined,
  checks: GetPRChecksResult | undefined,
) {
  if (!header) return null;

  return {
    prNumber: header.prNumber,
    repoFullName: header.repoFullName,
    prUrl: header.prUrl,
    prTitle: header.prTitle,
    prState: header.prState,
    baseBranch: header.baseBranch,
    headBranch: header.headBranch,
    headSha: header.headSha,
    comments: comments?.comments ?? { unresolved: [], resolved: [] },
    checks: checks?.checks ?? [],
    coverageCheck: checks?.coverageCheck ?? null,
    mergeableState: header.mergeableState,
    hasConflicts: header.hasConflicts,
    isMergeable: header.isMergeable,
    isAutoMergeEnabled: header.isAutoMergeEnabled,
  };
}
