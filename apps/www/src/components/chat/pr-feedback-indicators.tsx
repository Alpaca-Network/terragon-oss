"use client";

import { MessageCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useServerActionQuery } from "@/queries/server-action-helpers";
import { getPRHeader } from "@/server-actions/get-pr-header";
import { getPRComments } from "@/server-actions/get-pr-comments";
import { getPRChecks } from "@/server-actions/get-pr-checks";
import { cn } from "@/lib/utils";
import { useSetAtom } from "jotai";
import { secondaryPanelViewAtom } from "@/atoms/user-cookies";
import { useSecondaryPanel } from "./hooks";
import { SecondaryPanelView } from "@/lib/cookies";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PRFeedbackIndicatorsProps {
  threadId: string;
  hasPR: boolean;
}

export function PRFeedbackIndicators({
  threadId,
  hasPR,
}: PRFeedbackIndicatorsProps) {
  const setSecondaryPanelView = useSetAtom(secondaryPanelViewAtom);
  const { setIsSecondaryPanelOpen } = useSecondaryPanel();

  // Use split queries for faster loading
  // Header query - loads first and provides headSha for checks
  const headerQuery = useServerActionQuery({
    queryKey: ["pr-header", threadId],
    queryFn: () => getPRHeader({ threadId }),
    enabled: hasPR,
    staleTime: 10000, // 10 seconds
    refetchInterval: 15000, // Refetch every 15 seconds for frequent updates
  });

  // Comments query - loads in parallel with header
  const commentsQuery = useServerActionQuery({
    queryKey: ["pr-comments", threadId],
    queryFn: () => getPRComments({ threadId }),
    enabled: hasPR && headerQuery.isSuccess,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  // Checks query - requires headSha from header
  const checksQuery = useServerActionQuery({
    queryKey: ["pr-checks", threadId, headerQuery.data?.headSha],
    queryFn: () =>
      getPRChecks({ threadId, headSha: headerQuery.data?.headSha }),
    enabled: hasPR && headerQuery.isSuccess && !!headerQuery.data?.headSha,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  // Don't render anything if no PR
  if (!hasPR) {
    return null;
  }

  const handleIndicatorClick = (view: SecondaryPanelView) => {
    setSecondaryPanelView(view);
    setIsSecondaryPanelOpen(true);
  };

  // Show loading state only if header is loading (first query)
  if (headerQuery.isLoading) {
    return (
      <div className="flex items-center gap-1">
        <Loader2 className="size-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Compute summary from split queries
  const failingCount = checksQuery.data?.summary.failingCount ?? 0;
  const pendingCount = checksQuery.data?.summary.pendingCount ?? 0;
  const passingCount = checksQuery.data?.summary.passingCount ?? 0;
  const unresolvedCount = commentsQuery.data?.summary.unresolvedCount ?? 0;
  const resolvedCount = commentsQuery.data?.summary.resolvedCount ?? 0;

  return (
    <div className="flex items-center gap-1">
      <ChecksIndicator
        failingCount={failingCount}
        pendingCount={pendingCount}
        passingCount={passingCount}
        isLoading={checksQuery.isLoading}
        onClick={() => handleIndicatorClick("checks")}
      />
      <CommentsIndicator
        unresolvedCount={unresolvedCount}
        resolvedCount={resolvedCount}
        isLoading={commentsQuery.isLoading}
        onClick={() => handleIndicatorClick("comments")}
      />
    </div>
  );
}

interface ChecksIndicatorProps {
  failingCount: number;
  pendingCount: number;
  passingCount: number;
  isLoading?: boolean;
  onClick: () => void;
}

function ChecksIndicator({
  failingCount,
  pendingCount,
  passingCount,
  isLoading,
  onClick,
}: ChecksIndicatorProps) {
  const totalCount = failingCount + pendingCount + passingCount;

  // Show loading indicator while checks are loading
  if (isLoading) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border",
          "transition-colors cursor-pointer",
          "bg-muted/50 text-muted-foreground border-muted",
        )}
        aria-label="Loading checks..."
      >
        <Loader2 className="size-3 animate-spin" />
      </button>
    );
  }

  // Don't show if no checks
  if (totalCount === 0) {
    return null;
  }

  // Determine the status and color
  let colorClasses: string;
  let Icon: typeof XCircle;
  let tooltipText: string;

  if (failingCount > 0) {
    colorClasses =
      "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20";
    Icon = XCircle;
    tooltipText = `${failingCount} failing check${failingCount !== 1 ? "s" : ""}`;
  } else if (pendingCount > 0) {
    colorClasses =
      "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/20 border-yellow-500/20";
    Icon = Loader2;
    tooltipText = `${pendingCount} pending check${pendingCount !== 1 ? "s" : ""}`;
  } else {
    colorClasses =
      "bg-green-500/10 text-green-700 dark:text-green-300 hover:bg-green-500/20 border-green-500/20";
    Icon = CheckCircle2;
    tooltipText = `${passingCount} passing check${passingCount !== 1 ? "s" : ""}`;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border",
            "transition-colors cursor-pointer",
            colorClasses,
          )}
          aria-label={tooltipText}
        >
          <Icon
            className={cn(
              "size-3",
              pendingCount > 0 && failingCount === 0 && "animate-spin",
            )}
          />
          {failingCount > 0 ? (
            <span>{failingCount}</span>
          ) : pendingCount > 0 ? (
            <span>{pendingCount}</span>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface CommentsIndicatorProps {
  unresolvedCount: number;
  resolvedCount: number;
  isLoading?: boolean;
  onClick: () => void;
}

function CommentsIndicator({
  unresolvedCount,
  resolvedCount,
  isLoading,
  onClick,
}: CommentsIndicatorProps) {
  const totalCount = unresolvedCount + resolvedCount;

  // Show loading indicator while comments are loading
  if (isLoading) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border",
          "transition-colors cursor-pointer",
          "bg-muted/50 text-muted-foreground border-muted",
        )}
        aria-label="Loading comments..."
      >
        <MessageCircle className="size-3" />
        <Loader2 className="size-2 animate-spin" />
      </button>
    );
  }

  // Don't show if no comments
  if (totalCount === 0) {
    return null;
  }

  // Determine the color based on unresolved comments
  let colorClasses: string;
  let tooltipText: string;

  if (unresolvedCount > 0) {
    colorClasses =
      "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/20 border-yellow-500/20";
    tooltipText = `${unresolvedCount} unresolved comment${unresolvedCount !== 1 ? "s" : ""}`;
    if (resolvedCount > 0) {
      tooltipText += `, ${resolvedCount} resolved`;
    }
  } else {
    colorClasses =
      "bg-green-500/10 text-green-700 dark:text-green-300 hover:bg-green-500/20 border-green-500/20";
    tooltipText = `${resolvedCount} resolved comment${resolvedCount !== 1 ? "s" : ""}`;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border",
            "transition-colors cursor-pointer",
            colorClasses,
          )}
          aria-label={tooltipText}
        >
          <MessageCircle className="size-3" />
          {unresolvedCount > 0 ? (
            <span>{unresolvedCount}</span>
          ) : (
            <span>{resolvedCount}</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
