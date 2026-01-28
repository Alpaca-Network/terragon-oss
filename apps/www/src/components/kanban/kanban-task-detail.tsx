"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useMemo } from "react";
import { getThreadTitle } from "@/agent/thread-utils";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { ThreadStatusIndicator } from "../thread-status";
import { PRStatusPill } from "../pr-status-pill";
import { ThreadAgentIcon } from "../thread-agent-icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  GitBranch,
  GitPullRequest,
  ExternalLink,
  Calendar,
  Clock,
  Archive,
} from "lucide-react";
import Link from "next/link";
import { KanbanColumn, KANBAN_COLUMNS, getKanbanColumn } from "./types";

export const KanbanTaskDetail = memo(function KanbanTaskDetail({
  thread,
  open,
  onClose,
}: {
  thread: ThreadInfo | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!thread) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <TaskDetailContent thread={thread} />
      </SheetContent>
    </Sheet>
  );
});

const TaskDetailContent = memo(function TaskDetailContent({
  thread,
}: {
  thread: ThreadInfo;
}) {
  const title = useMemo(() => getThreadTitle(thread), [thread]);
  const createdTime = useMemo(
    () => formatRelativeTime(thread.createdAt),
    [thread.createdAt],
  );
  const updatedTime = useMemo(
    () => formatRelativeTime(thread.updatedAt),
    [thread.updatedAt],
  );
  const kanbanColumn = getKanbanColumn(thread);
  const columnConfig = KANBAN_COLUMNS.find((c) => c.id === kanbanColumn);

  const getColumnBadgeColor = (columnId: KanbanColumn) => {
    switch (columnId) {
      case "backlog":
        return "bg-muted text-muted-foreground";
      case "in_progress":
        return "bg-primary/10 text-primary border border-primary/20";
      case "in_review":
        return "bg-accent/10 text-accent-foreground border border-accent/20";
      case "done":
        return "bg-primary/10 text-primary border border-primary/20";
      case "cancelled":
        return "bg-destructive/10 text-destructive border border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <SheetHeader className="px-6 py-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="mt-1 flex-shrink-0">
              <ThreadStatusIndicator thread={thread} />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-semibold line-clamp-2">
                {title}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Task details
              </SheetDescription>
            </div>
          </div>
        </div>
      </SheetHeader>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-4 space-y-6">
          {/* Status badge */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Status
            </h3>
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                getColumnBadgeColor(kanbanColumn),
              )}
            >
              {columnConfig?.title || kanbanColumn}
            </span>
          </div>

          {/* Repository info */}
          {thread.githubRepoFullName && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Repository
              </h3>
              <a
                href={`https://github.com/${thread.githubRepoFullName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <GitBranch className="size-4" />
                {thread.githubRepoFullName}
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}

          {/* PR info */}
          {thread.githubPRNumber && thread.prStatus && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Pull Request
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={`https://github.com/${thread.githubRepoFullName}/pull/${thread.githubPRNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <GitPullRequest className="size-4" />#{thread.githubPRNumber}
                  <ExternalLink className="size-3" />
                </a>
                <PRStatusPill
                  status={thread.prStatus}
                  checksStatus={thread.prChecksStatus}
                  prNumber={thread.githubPRNumber}
                  repoFullName={thread.githubRepoFullName}
                />
              </div>
            </div>
          )}

          {/* Agent info */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Agent
            </h3>
            <div className="flex items-center gap-2">
              <ThreadAgentIcon thread={thread} />
              {thread.authorName && (
                <span className="text-sm text-muted-foreground">
                  Created by {thread.authorName}
                </span>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Created
              </h3>
              <div
                className="flex items-center gap-1.5 text-sm"
                title={new Date(thread.createdAt).toLocaleString()}
              >
                <Calendar className="size-4 text-muted-foreground" />
                {createdTime}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Updated
              </h3>
              <div
                className="flex items-center gap-1.5 text-sm"
                title={new Date(thread.updatedAt).toLocaleString()}
              >
                <Clock className="size-4 text-muted-foreground" />
                {updatedTime}
              </div>
            </div>
          </div>

          {/* Additional info */}
          {thread.archived && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Archive className="size-4" />
              <span>This task is archived</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer with action button */}
      <div className="px-6 py-4 border-t bg-muted/30">
        <Link href={`/task/${thread.id}`} className="block w-full">
          <Button className="w-full" variant="default">
            <ExternalLink className="size-4 mr-2" />
            Open Task
          </Button>
        </Link>
      </div>
    </div>
  );
});
