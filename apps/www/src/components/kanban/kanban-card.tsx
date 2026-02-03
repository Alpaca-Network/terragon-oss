"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useMemo, useCallback, useState, MouseEvent } from "react";
import { getThreadTitle } from "@/agent/thread-utils";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { ThreadStatusIndicator } from "../thread-status";
import { PRStatusPill } from "../pr-status-pill";
import { ThreadAgentIcon } from "../thread-agent-icon";
import { PRFeedbackBadge } from "./pr-feedback-badge";
import { ThreadMenuDropdown } from "../thread-menu-dropdown";
import { Button } from "@/components/ui/button";
import { GitBranch, EllipsisVertical, Play, LoaderCircle } from "lucide-react";
import { isDraftThread, isErrorThread } from "./types";
import { useSubmitDraftThreadMutation } from "@/queries/thread-mutations";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLongPress } from "@/hooks/useLongPress";

export const KanbanCard = memo(function KanbanCard({
  thread,
  isSelected,
  onClick,
  onCommentsClick,
}: {
  thread: ThreadInfo;
  isSelected: boolean;
  onClick: () => void;
  onCommentsClick?: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const submitDraftMutation = useSubmitDraftThreadMutation();
  const isDraft = useMemo(() => isDraftThread(thread), [thread]);
  const isError = useMemo(() => isErrorThread(thread), [thread]);
  const title = useMemo(() => getThreadTitle(thread), [thread]);
  const relativeTime = useMemo(
    () => formatRelativeTime(thread.updatedAt),
    [thread.updatedAt],
  );

  const handleMenuClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const handleStartTask = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!thread.draftMessage) {
        toast.error("No draft message found");
        return;
      }

      setIsStarting(true);
      try {
        await submitDraftMutation.mutateAsync({
          threadId: thread.id,
          userMessage: thread.draftMessage,
          selectedModels: {},
        });
        toast.success("Task started");
      } catch (error) {
        console.error("Failed to start task:", error);
        toast.error("Failed to start task");
      } finally {
        setIsStarting(false);
      }
    },
    [thread, submitDraftMutation],
  );

  // Handle context menu (right-click on desktop, long-press on mobile)
  const handleContextMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  const longPressHandlers = useLongPress({
    onLongPress: handleContextMenu,
  });

  return (
    <div
      onClick={onClick}
      onContextMenu={longPressHandlers.onContextMenu}
      onTouchStart={longPressHandlers.onTouchStart}
      onTouchEnd={longPressHandlers.onTouchEnd}
      onTouchMove={longPressHandlers.onTouchMove}
      className={cn(
        "group relative bg-card border rounded-xl p-2.5 cursor-pointer",
        "transition-all duration-200 ease-out",
        "tap-highlight card-float-hover",
        "hover:border-primary/40 active:scale-[0.98]",
        isSelected &&
          "ring-2 ring-primary border-primary shadow-[0_0_20px_rgba(99,102,241,0.15)]",
        isError && "bg-destructive/10 border-destructive/30",
      )}
    >
      {/* Three dots menu - show when not a draft or when menu is open */}
      {(!isDraft || isMenuOpen) && (
        <div
          className={cn(
            "absolute right-1.5 top-1.5 transition-opacity",
            isMenuOpen
              ? "opacity-100"
              : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
          )}
          onClick={handleMenuClick}
        >
          <ThreadMenuDropdown
            thread={thread}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-muted"
              >
                <EllipsisVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
            }
            showReadUnreadActions
            open={isMenuOpen}
            onMenuOpenChange={setIsMenuOpen}
          />
        </div>
      )}

      {/* Start Task button - shown on hover for draft tasks */}
      {isDraft && !isMenuOpen && (
        <div className="absolute top-1.5 right-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="h-7 w-7"
                onClick={handleStartTask}
                disabled={isStarting}
              >
                {isStarting ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Start task</TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {/* Header with status and title */}
        <div className="flex items-start gap-2 pr-6">
          <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center mt-0.5">
            <ThreadStatusIndicator thread={thread} />
          </div>
          <h4 className="text-sm font-medium line-clamp-2 flex-1" title={title}>
            {title}
          </h4>
        </div>

        {/* Repository info */}
        {thread.githubRepoFullName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="size-3 flex-shrink-0" />
            <span className="truncate" title={thread.githubRepoFullName}>
              {thread.githubRepoFullName}
            </span>
          </div>
        )}

        {/* Footer with metadata */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-xs text-muted-foreground"
            title={new Date(thread.updatedAt).toLocaleString()}
          >
            {relativeTime}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {thread.githubPRNumber && (
              <PRFeedbackBadge
                threadId={thread.id}
                repoFullName={thread.githubRepoFullName}
                prNumber={thread.githubPRNumber}
                onCommentsClick={(e) => {
                  e.stopPropagation();
                  onCommentsClick?.();
                }}
                onChecksClick={(e) => {
                  e.stopPropagation();
                  // All feedback indicators open the code review view
                  onCommentsClick?.();
                }}
                onConflictsClick={(e) => {
                  e.stopPropagation();
                  // All feedback indicators open the code review view
                  onCommentsClick?.();
                }}
              />
            )}
            {thread.githubPRNumber && thread.prStatus && (
              <PRStatusPill
                status={thread.prStatus}
                checksStatus={thread.prChecksStatus}
                prNumber={thread.githubPRNumber}
                repoFullName={thread.githubRepoFullName}
              />
            )}
            <ThreadAgentIcon thread={thread} />
          </div>
        </div>
      </div>
    </div>
  );
});
