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
import { LoaderCircle } from "lucide-react";
import {
  ThreadListFilters,
  useInfiniteThreadList,
} from "@/queries/thread-queries";
import { useRealtimeThreadMatch } from "@/hooks/useRealtime";
import { BroadcastUserMessage } from "@terragon/types/broadcast";

export const KanbanBoard = memo(function KanbanBoard({
  queryFilters,
}: {
  queryFilters: ThreadListFilters;
}) {
  const [selectedThread, setSelectedThread] = useState<ThreadInfo | null>(null);

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
      // Skip archived threads in Kanban view
      if (thread.archived) {
        continue;
      }
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
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <KanbanTaskDetail
        thread={selectedThread}
        open={selectedThread !== null}
        onClose={handleCloseDetail}
      />
    </>
  );
});
