"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useMemo, useState, useCallback } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { KanbanColumn } from "./kanban-column";
import { KanbanTaskDetail } from "./kanban-task-detail";
import {
  KanbanColumn as KanbanColumnType,
  KANBAN_COLUMNS,
  getKanbanColumn,
} from "./types";
import { LoaderCircle, SquarePen } from "lucide-react";
import {
  ThreadListFilters,
  useInfiniteThreadList,
} from "@/queries/thread-queries";
import { useRealtimeThreadMatch } from "@/hooks/useRealtime";
import { BroadcastUserMessage } from "@terragon/types/broadcast";
import { Button } from "@/components/ui/button";
import { NewTaskDialog } from "./new-task-dialog";
import { QuickAddBacklogDialog } from "./quick-add-backlog";
import { useAtom } from "jotai";
import { kanbanNewTaskDialogOpenAtom } from "@/atoms/user-cookies";

export const KanbanBoard = memo(function KanbanBoard({
  queryFilters,
}: {
  queryFilters: ThreadListFilters;
}) {
  const [selectedThread, setSelectedThread] = useState<ThreadInfo | null>(null);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useAtom(
    kanbanNewTaskDialogOpenAtom,
  );
  const [isQuickAddBacklogOpen, setIsQuickAddBacklogOpen] = useState(false);

  const { data, isLoading, isError, refetch } =
    useInfiniteThreadList(queryFilters);

  const threads = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data],
  );

  const threadIds = useMemo(() => new Set(threads.map((t) => t.id)), [threads]);

  // Group threads by Kanban column
  const columnThreads = useMemo(() => {
    const groups: Record<KanbanColumnType, ThreadInfo[]> = {
      backlog: [],
      in_progress: [],
      in_review: [],
      done: [],
      cancelled: [],
    };

    for (const thread of threads) {
      const column = getKanbanColumn(thread);
      groups[column].push(thread);
    }

    // Sort each column by updatedAt (most recent first)
    for (const column of Object.keys(groups) as KanbanColumnType[]) {
      groups[column].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    return groups;
  }, [threads]);

  const showArchived = queryFilters.archived ?? false;
  const automationId = queryFilters.automationId;

  const matchThread = useCallback(
    (threadId: string, data: BroadcastUserMessage["data"]) => {
      if (threadIds.has(threadId)) {
        if (data.messagesUpdated && !data.threadStatusUpdated) {
          return false;
        }
        return true;
      }
      if (automationId && data.threadAutomationId !== automationId) {
        return false;
      }
      if (typeof data.isThreadArchived === "boolean") {
        if (showArchived === data.isThreadArchived) {
          return true;
        }
      }
      if (data.isThreadCreated) {
        return true;
      }
      return false;
    },
    [threadIds, showArchived, automationId],
  );

  useRealtimeThreadMatch({
    matchThread,
    onThreadChange: () => {
      refetch();
    },
  });

  const handleThreadSelect = useCallback((thread: ThreadInfo) => {
    setSelectedThread(thread);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedThread(null);
  }, []);

  const handleOpenNewTaskDialog = useCallback(() => {
    setIsNewTaskDialogOpen(true);
  }, []);

  const handleOpenQuickAddBacklog = useCallback(() => {
    setIsQuickAddBacklogOpen(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Loading tasks...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Failed to load tasks. Please try again.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full w-full">
        {/* Board header with New Task button */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Tasks</h2>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={handleOpenNewTaskDialog}
          >
            <SquarePen className="h-4 w-4" />
            New Task
          </Button>
        </div>

        {/* Kanban columns */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="flex gap-4 p-4 h-full min-h-[500px]">
              {KANBAN_COLUMNS.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column.id}
                  threads={columnThreads[column.id]}
                  selectedThreadId={selectedThread?.id ?? null}
                  onThreadSelect={handleThreadSelect}
                  onAddToBacklog={
                    column.id === "backlog"
                      ? handleOpenQuickAddBacklog
                      : undefined
                  }
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>

      <KanbanTaskDetail
        thread={selectedThread}
        open={selectedThread !== null}
        onClose={handleCloseDetail}
      />

      <NewTaskDialog
        open={isNewTaskDialogOpen}
        onOpenChange={setIsNewTaskDialogOpen}
      />

      <QuickAddBacklogDialog
        open={isQuickAddBacklogOpen}
        onOpenChange={setIsQuickAddBacklogOpen}
      />
    </>
  );
});
