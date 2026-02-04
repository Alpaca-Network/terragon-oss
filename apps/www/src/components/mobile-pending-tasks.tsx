"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useMemo, useCallback, useState } from "react";
import { useInfiniteThreadList } from "@/queries/thread-queries";
import { getKanbanColumn } from "./kanban/types";
import { KanbanCard } from "./kanban/kanban-card";
import { KanbanTaskDrawer } from "./kanban/kanban-task-drawer";
import { KanbanNewTaskDrawer } from "./kanban/kanban-new-task-drawer";
import { useRealtimeThreadMatch } from "@/hooks/useRealtime";
import { BroadcastUserMessage } from "@terragon/types/broadcast";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const MobilePendingTasks = memo(function MobilePendingTasks({
  className,
}: {
  className?: string;
}) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newTaskDrawerOpen, setNewTaskDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState<
    "feed" | "changes" | "code-review"
  >("feed");

  const { data, isLoading, refetch } = useInfiniteThreadList({
    archived: false,
    isBacklog: false,
  });

  const threads = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data],
  );

  const threadIds = useMemo(() => new Set(threads.map((t) => t.id)), [threads]);

  // Filter to only show in-progress and in-review tasks
  const pendingTasks = useMemo(() => {
    return threads.filter((thread) => {
      const column = getKanbanColumn(thread);
      return column === "in_progress" || column === "in_review";
    });
  }, [threads]);

  const matchThread = useCallback(
    (threadId: string, data: BroadcastUserMessage["data"]) => {
      if (threadIds.has(threadId)) {
        if (data.messagesUpdated && !data.threadStatusUpdated) {
          return false;
        }
        return true;
      }
      if (typeof data.isThreadArchived === "boolean") {
        if (!data.isThreadArchived) {
          return true;
        }
      }
      if (data.isThreadCreated) {
        return true;
      }
      return false;
    },
    [threadIds],
  );

  useRealtimeThreadMatch({
    matchThread,
    onThreadChange: () => {
      refetch();
    },
  });

  const handleThreadSelect = useCallback((thread: ThreadInfo) => {
    setDrawerInitialTab("feed");
    setSelectedThreadId(thread.id);
  }, []);

  const handleThreadCommentsClick = useCallback((thread: ThreadInfo) => {
    setDrawerInitialTab("code-review");
    setSelectedThreadId(thread.id);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedThreadId(null);
  }, []);

  const handleOpenNewTaskDrawer = useCallback(() => {
    setNewTaskDrawerOpen(true);
  }, []);

  const handleCloseNewTaskDrawer = useCallback(() => {
    setNewTaskDrawerOpen(false);
  }, []);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pendingTasks.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">
        Active Tasks ({pendingTasks.length})
      </h3>
      <div className="space-y-2">
        {pendingTasks.map((thread) => (
          <KanbanCard
            key={thread.id}
            thread={thread}
            isSelected={selectedThreadId === thread.id}
            onClick={() => handleThreadSelect(thread)}
            onCommentsClick={() => handleThreadCommentsClick(thread)}
          />
        ))}
      </div>

      {/* Task detail drawer */}
      <KanbanTaskDrawer
        threadId={selectedThreadId}
        open={!!selectedThreadId}
        onClose={handleCloseDrawer}
        initialTab={drawerInitialTab}
        onNewTask={handleOpenNewTaskDrawer}
      />

      {/* New task drawer */}
      <KanbanNewTaskDrawer
        open={newTaskDrawerOpen}
        onClose={handleCloseNewTaskDrawer}
        queryFilters={{ archived: false, isBacklog: false }}
      />
    </div>
  );
});
