"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useMemo } from "react";
import { getThreadTitle } from "@/agent/thread-utils";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { ThreadStatusIndicator } from "../thread-status";
import { PRStatusPill } from "../pr-status-pill";
import { ThreadAgentIcon } from "../thread-agent-icon";
import { PRCommentCountBadge } from "./pr-comment-count-badge";
import { GitBranch } from "lucide-react";

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
  const title = useMemo(() => getThreadTitle(thread), [thread]);
  const relativeTime = useMemo(
    () => formatRelativeTime(thread.updatedAt),
    [thread.updatedAt],
  );

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
        isSelected && "ring-2 ring-primary border-primary",
      )}
    >
      <div className="flex flex-col gap-2">
        {/* Header with status and title */}
        <div className="flex items-start gap-2">
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
        <div className="flex items-center justify-between gap-2 pt-1">
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
