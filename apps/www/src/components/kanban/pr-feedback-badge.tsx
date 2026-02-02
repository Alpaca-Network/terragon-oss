"use client";

import {
  MessageCircle,
  XCircle,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useServerActionQuery } from "@/queries/server-action-helpers";
import { getPRFeedback } from "@/server-actions/get-pr-feedback";
import { createFeedbackSummary } from "@terragon/shared/github/pr-feedback";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PRFeedbackBadgeProps {
  threadId: string;
  repoFullName: string | null;
  prNumber: number | null;
  onCommentsClick?: (e: React.MouseEvent) => void;
  onChecksClick?: (e: React.MouseEvent) => void;
  onConflictsClick?: (e: React.MouseEvent) => void;
}

export function PRFeedbackBadge({
  threadId,
  repoFullName,
  prNumber,
  onCommentsClick,
  onChecksClick,
  onConflictsClick,
}: PRFeedbackBadgeProps) {
  const { data, isLoading } = useServerActionQuery({
    queryKey: ["pr-feedback-summary", threadId],
    queryFn: () => getPRFeedback({ threadId }),
    enabled: !!repoFullName && !!prNumber,
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // Refetch every 2 minutes
  });

  // Don't render anything if no PR or still loading
  if (!repoFullName || !prNumber || isLoading || !data) {
    return null;
  }

  const summary = createFeedbackSummary(data.feedback);
  const {
    unresolvedCommentCount,
    failingCheckCount,
    pendingCheckCount,
    passingCheckCount,
    hasConflicts,
  } = summary;

  const totalCheckCount =
    failingCheckCount + pendingCheckCount + passingCheckCount;
  const hasComments = unresolvedCommentCount > 0;
  const hasFailingChecks = failingCheckCount > 0;
  const hasPendingChecks = pendingCheckCount > 0;
  const hasChecks = totalCheckCount > 0;

  // Don't show badge if nothing to display
  if (!hasComments && !hasChecks && !hasConflicts) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {/* Conflicts indicator */}
      {hasConflicts && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onConflictsClick}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs",
                "bg-destructive/10 text-destructive",
                "hover:bg-destructive/20 transition-colors",
                "cursor-pointer",
              )}
              aria-label="Has merge conflicts"
            >
              <AlertCircle className="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Has merge conflicts</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Checks indicator */}
      {hasChecks && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onChecksClick}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs",
                "transition-colors cursor-pointer",
                hasFailingChecks
                  ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : hasPendingChecks
                    ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/20"
                    : "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20",
              )}
              aria-label={
                hasFailingChecks
                  ? `${failingCheckCount} failing check${failingCheckCount !== 1 ? "s" : ""}`
                  : hasPendingChecks
                    ? `${pendingCheckCount} pending check${pendingCheckCount !== 1 ? "s" : ""}`
                    : `${passingCheckCount} passing check${passingCheckCount !== 1 ? "s" : ""}`
              }
            >
              {hasFailingChecks ? (
                <XCircle className="size-3" />
              ) : hasPendingChecks ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3" />
              )}
              {(hasFailingChecks || hasPendingChecks) && (
                <span>
                  {hasFailingChecks ? failingCheckCount : pendingCheckCount}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>
              {hasFailingChecks
                ? `${failingCheckCount} failing check${failingCheckCount !== 1 ? "s" : ""}`
                : hasPendingChecks
                  ? `${pendingCheckCount} pending check${pendingCheckCount !== 1 ? "s" : ""}`
                  : `${passingCheckCount} passing check${passingCheckCount !== 1 ? "s" : ""}`}
            </p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Comments indicator */}
      {hasComments && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCommentsClick}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs",
                "bg-accent/10 text-accent-foreground",
                "hover:bg-accent/20 transition-colors",
                "cursor-pointer",
              )}
              aria-label={`${unresolvedCommentCount} unresolved comment${unresolvedCommentCount !== 1 ? "s" : ""}`}
            >
              <MessageCircle className="size-3" />
              <span>{unresolvedCommentCount}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>
              {unresolvedCommentCount} unresolved comment
              {unresolvedCommentCount !== 1 ? "s" : ""}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
