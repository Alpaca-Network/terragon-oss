"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, CheckCircle2, BarChart3, GitMerge } from "lucide-react";

/**
 * Skeleton for the PR header section
 */
export function PRHeaderSkeleton() {
  return (
    <div className="border-b px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GitMerge className="size-4 flex-shrink-0 text-muted-foreground" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <Skeleton className="h-4 w-48" />
    </div>
  );
}

/**
 * Skeleton for the comments tab content
 */
export function CommentsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Unresolved section header */}
      <div className="flex items-center gap-2 px-1">
        <MessageSquare className="size-4 text-muted-foreground" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Comment thread skeletons */}
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 p-3">
            <Skeleton className="size-4" />
            <Skeleton className="h-4 flex-1 max-w-[200px]" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="border-t p-3">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="pl-7 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for the checks tab content
 */
export function ChecksSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="size-4 text-muted-foreground" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      {/* Check list */}
      <div className="flex flex-col gap-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-md">
            <Skeleton className="size-4 rounded-full" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for the coverage tab content
 */
export function CoverageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <BarChart3 className="size-8 mb-2 text-muted-foreground opacity-50" />
      <Skeleton className="h-4 w-32 mb-1" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

/**
 * Skeleton for the merge status tab content
 */
export function MergeStatusSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1">
        <GitMerge className="size-4 text-muted-foreground" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-5 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-40 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generic loading state for code review tabs
 */
export function CodeReviewTabSkeleton({
  variant = "comments",
}: {
  variant?: "comments" | "checks" | "coverage" | "merge";
}) {
  switch (variant) {
    case "comments":
      return <CommentsSkeleton />;
    case "checks":
      return <ChecksSkeleton />;
    case "coverage":
      return <CoverageSkeleton />;
    case "merge":
      return <MergeStatusSkeleton />;
    default:
      return <CommentsSkeleton />;
  }
}
