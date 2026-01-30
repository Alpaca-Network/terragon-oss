"use client";

import { MessageCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useServerActionQuery } from "@/queries/server-action-helpers";
import { getPRFeedback } from "@/server-actions/get-pr-feedback";
import { createFeedbackSummary } from "@terragon/shared/github/pr-feedback";
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

  const { data, isLoading } = useServerActionQuery({
    queryKey: ["pr-feedback-indicators", threadId],
    queryFn: () => getPRFeedback({ threadId }),
    enabled: hasPR,
    staleTime: 10000, // 10 seconds
    refetchInterval: 15000, // Refetch every 15 seconds for frequent updates
  });

  // Don't render anything if no PR
  if (!hasPR) {
    return null;
  }

  const handleIndicatorClick = (view: SecondaryPanelView) => {
    setSecondaryPanelView(view);
    setIsSecondaryPanelOpen(true);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-1">
        <Loader2 className="size-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Don't render if no data
  if (!data) {
    return null;
  }

  const summary = createFeedbackSummary(data.feedback);

  return (
    <div className="flex items-center gap-1">
      <ChecksIndicator
        failingCount={summary.failingCheckCount}
        pendingCount={summary.pendingCheckCount}
        passingCount={summary.passingCheckCount}
        onClick={() => handleIndicatorClick("checks")}
      />
      <CommentsIndicator
        unresolvedCount={summary.unresolvedCommentCount}
        resolvedCount={summary.resolvedCommentCount}
        onClick={() => handleIndicatorClick("comments")}
      />
    </div>
  );
}

interface ChecksIndicatorProps {
  failingCount: number;
  pendingCount: number;
  passingCount: number;
  onClick: () => void;
}

function ChecksIndicator({
  failingCount,
  pendingCount,
  passingCount,
  onClick,
}: ChecksIndicatorProps) {
  const totalCount = failingCount + pendingCount + passingCount;

  // Don't show if no checks
  if (totalCount === 0) {
    return null;
  }

  // Determine the status and color
  let status: "failing" | "pending" | "passing";
  let colorClasses: string;
  let Icon: typeof XCircle;
  let tooltipText: string;

  if (failingCount > 0) {
    status = "failing";
    colorClasses =
      "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20";
    Icon = XCircle;
    tooltipText = `${failingCount} failing check${failingCount !== 1 ? "s" : ""}`;
  } else if (pendingCount > 0) {
    status = "pending";
    colorClasses =
      "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/20 border-yellow-500/20";
    Icon = Loader2;
    tooltipText = `${pendingCount} pending check${pendingCount !== 1 ? "s" : ""}`;
  } else {
    status = "passing";
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
            className={cn("size-3", status === "pending" && "animate-spin")}
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
  onClick: () => void;
}

function CommentsIndicator({
  unresolvedCount,
  resolvedCount,
  onClick,
}: CommentsIndicatorProps) {
  const totalCount = unresolvedCount + resolvedCount;

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
