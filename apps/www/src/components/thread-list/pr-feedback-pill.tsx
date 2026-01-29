"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  XCircle,
  AlertCircle,
  CheckCircle2,
  GitMerge,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PRFeedbackPillData = {
  hasUnresolvedComments: boolean;
  unresolvedCommentCount: number;
  hasFailingChecks: boolean;
  failingCheckCount: number;
  hasPendingChecks: boolean;
  pendingCheckCount: number;
  hasConflicts: boolean;
  isMergeable: boolean;
  hasCoverageIssues: boolean;
};

// Compact pill for list view
export const PRFeedbackPill = memo(function PRFeedbackPill({
  data,
  className,
}: {
  data: PRFeedbackPillData;
  className?: string;
}) {
  const {
    hasUnresolvedComments,
    unresolvedCommentCount,
    hasFailingChecks,
    failingCheckCount,
    hasPendingChecks,
    hasConflicts,
    isMergeable,
    hasCoverageIssues,
  } = data;

  // Determine overall status
  const hasIssues =
    hasUnresolvedComments ||
    hasFailingChecks ||
    hasConflicts ||
    hasCoverageIssues;
  const isPending = hasPendingChecks && !hasFailingChecks;
  const isReady = isMergeable && !hasIssues && !isPending;

  if (isReady) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium",
                "bg-green-500/10 text-green-600 dark:text-green-400",
                className,
              )}
            >
              <GitMerge className="size-3" />
              <span>Ready</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>PR is ready to merge</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show compact indicators for issues
  const indicators: React.ReactNode[] = [];

  if (hasConflicts) {
    indicators.push(
      <TooltipProvider key="conflicts">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center text-red-500">
              <AlertCircle className="size-3" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Has merge conflicts</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
  }

  if (hasFailingChecks) {
    indicators.push(
      <TooltipProvider key="checks">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-0.5 text-red-500">
              <XCircle className="size-3" />
              <span className="text-[10px]">{failingCheckCount}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {failingCheckCount} failing check
              {failingCheckCount === 1 ? "" : "s"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
  }

  if (hasUnresolvedComments) {
    indicators.push(
      <TooltipProvider key="comments">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-0.5 text-amber-500">
              <MessageSquare className="size-3" />
              <span className="text-[10px]">{unresolvedCommentCount}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {unresolvedCommentCount} unresolved comment
              {unresolvedCommentCount === 1 ? "" : "s"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
  }

  if (hasCoverageIssues) {
    indicators.push(
      <TooltipProvider key="coverage">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center text-amber-500">
              <AlertCircle className="size-3" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Coverage check failed</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
  }

  if (isPending && indicators.length === 0) {
    indicators.push(
      <TooltipProvider key="pending">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center text-muted-foreground">
              <CheckCircle2 className="size-3 animate-pulse" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Checks in progress</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
  }

  if (indicators.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/50",
        className,
      )}
    >
      {indicators}
    </div>
  );
});

// Extended pill with more detail for Kanban/expanded views
export const PRFeedbackPillExpanded = memo(function PRFeedbackPillExpanded({
  data,
  className,
}: {
  data: PRFeedbackPillData;
  className?: string;
}) {
  const {
    hasUnresolvedComments,
    unresolvedCommentCount,
    hasFailingChecks,
    failingCheckCount,
    hasPendingChecks,
    pendingCheckCount,
    hasConflicts,
    isMergeable,
    hasCoverageIssues,
  } = data;

  const items: React.ReactNode[] = [];

  if (hasConflicts) {
    items.push(
      <div
        key="conflicts"
        className="flex items-center gap-1 text-xs text-red-500"
      >
        <AlertCircle className="size-3" />
        <span>Conflicts</span>
      </div>,
    );
  }

  if (hasFailingChecks) {
    items.push(
      <div
        key="checks"
        className="flex items-center gap-1 text-xs text-red-500"
      >
        <XCircle className="size-3" />
        <span>{failingCheckCount} failing</span>
      </div>,
    );
  }

  if (hasPendingChecks && !hasFailingChecks) {
    items.push(
      <div
        key="pending"
        className="flex items-center gap-1 text-xs text-muted-foreground"
      >
        <CheckCircle2 className="size-3 animate-pulse" />
        <span>{pendingCheckCount} pending</span>
      </div>,
    );
  }

  if (hasUnresolvedComments) {
    items.push(
      <div
        key="comments"
        className="flex items-center gap-1 text-xs text-amber-500"
      >
        <MessageSquare className="size-3" />
        <span>{unresolvedCommentCount} comments</span>
      </div>,
    );
  }

  if (hasCoverageIssues) {
    items.push(
      <div
        key="coverage"
        className="flex items-center gap-1 text-xs text-amber-500"
      >
        <AlertCircle className="size-3" />
        <span>Coverage</span>
      </div>,
    );
  }

  if (isMergeable && items.length === 0) {
    items.push(
      <div
        key="ready"
        className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"
      >
        <GitMerge className="size-3" />
        <span>Ready to merge</span>
      </div>,
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {items}
    </div>
  );
});
