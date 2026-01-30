"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useMemo, useState, MouseEvent } from "react";
import { getThreadTitle } from "@/agent/thread-utils";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { ThreadStatusIndicator } from "../thread-status";
import { PRStatusPill } from "../pr-status-pill";
import { ThreadAgentIcon } from "../thread-agent-icon";
import { PRCommentCountBadge } from "./pr-comment-count-badge";
import { ThreadMenuDropdown } from "../thread-menu-dropdown";
import { Button } from "@/components/ui/button";
import { GitBranch, EllipsisVertical } from "lucide-react";

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
  const title = useMemo(() => getThreadTitle(thread), [thread]);
  const relativeTime = useMemo(
    () => formatRelativeTime(thread.updatedAt),
    [thread.updatedAt],
  );

  const handleMenuClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-card border rounded-xl p-2.5 cursor-pointer",
        "transition-all duration-200 ease-out",
        "tap-highlight card-float-hover",
        "hover:border-primary/40 active:scale-[0.98]",
        isSelected &&
          "ring-2 ring-primary border-primary shadow-[0_0_20px_rgba(99,102,241,0.15)]",
      )}
    >
      {/* Three dots menu */}
      <div
        className={cn(
          "absolute right-1.5 top-1.5 transition-opacity",
          isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
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
          onMenuOpenChange={setIsMenuOpen}
        />
      </div>

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
              <PRCommentCountBadge
                threadId={thread.id}
                repoFullName={thread.githubRepoFullName}
                prNumber={thread.githubPRNumber}
                onClick={(e) => {
                  e.stopPropagation();
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
