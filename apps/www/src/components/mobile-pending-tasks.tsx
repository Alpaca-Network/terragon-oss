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
import { Button } from "@/components/ui/button";

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

  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteThreadList({
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
      // Check if this update is for a thread already in our visible list
      const isThreadVisible = threadIds.has(threadId);

      if (isThreadVisible) {
        // If messages were updated but the status didn't change, we don't need to refetch.
        if (data.messagesUpdated && !data.threadStatusUpdated) {
          return false;
        }
        return true;
      }

      // For threads not in visible list, check if they should appear
      // This handles the case where thread exists on page 2+ or was just created/updated

      // Only show active (non-archived, non-backlog) tasks
      if (typeof data.isThreadArchived === "boolean") {
        if (!data.isThreadArchived) {
          // Check backlog status - reject if it's a backlog item
          if (typeof data.isThreadBacklog === "boolean") {
            if (data.isThreadBacklog) {
              return false;
            }
            // Explicitly not a backlog item - show it
            return true;
          }
          // Backlog status unknown - refetch to be safe
          return true;
        }
      }

      // Handle new thread creation - only if not in backlog
      if (data.isThreadCreated) {
        // Check backlog status for new threads
        if (typeof data.isThreadBacklog === "boolean") {
          // Reject backlog items
          if (data.isThreadBacklog) {
            return false;
          }
          // Explicitly not a backlog item - show it
          return true;
        }
        // Backlog status unknown - refetch to be safe
        return true;
      }

      // Handle thread status updates (could move thread between pages)
      if (data.threadStatusUpdated) {
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

  if (isError) {
    return (
      <div
        className={cn(
          "rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive",
          className,
        )}
      >
        Failed to load active tasks. Please try again.
      </div>
    );
  }

  // If no pending tasks and no more pages to load, don't render anything
  if (pendingTasks.length === 0 && !hasNextPage) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {pendingTasks.length > 0 && (
        <>
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
        </>
      )}

      {/* Load more button - show if there are more pages, even if current page has no pending tasks */}
      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full"
          >
            {isFetchingNextPage ? (
              <>
                <LoaderCircle className="size-3 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              "Load more tasks"
            )}
          </Button>
        </div>
      )}

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
