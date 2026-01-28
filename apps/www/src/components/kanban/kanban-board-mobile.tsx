"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useMemo, useState, useCallback } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanCard } from "./kanban-card";
import { KanbanTaskDrawer } from "./kanban-task-drawer";
import {
  KanbanColumn as KanbanColumnType,
  KANBAN_COLUMNS,
  getKanbanColumn,
} from "./types";
import {
  ThreadListFilters,
  useInfiniteThreadList,
} from "@/queries/thread-queries";
import { useRealtimeThreadMatch } from "@/hooks/useRealtime";
import { BroadcastUserMessage } from "@terragon/types/broadcast";
import { cn } from "@/lib/utils";

const getColumnHeaderColor = (columnId: KanbanColumnType) => {
  switch (columnId) {
    case "backlog":
      return "data-[state=active]:bg-muted";
    case "in_progress":
      return "data-[state=active]:bg-primary/10 data-[state=active]:text-primary";
    case "in_review":
      return "data-[state=active]:bg-accent/10 data-[state=active]:text-accent-foreground";
    case "done":
      return "data-[state=active]:bg-primary/10 data-[state=active]:text-primary";
    case "cancelled":
      return "data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive";
    default:
      return "data-[state=active]:bg-muted";
  }
};

export const KanbanBoardMobile = memo(function KanbanBoardMobile({
  queryFilters,
}: {
  queryFilters: ThreadListFilters;
}) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] =
    useState<KanbanColumnType>("in_progress");

  const showArchived = queryFilters.archived ?? false;
  const automationId = queryFilters.automationId;

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
    setSelectedThreadId(thread.id);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedThreadId(null);
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
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">
          Failed to load tasks. Please try again.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={activeColumn}
        onValueChange={(v) => setActiveColumn(v as KanbanColumnType)}
        className="flex flex-col h-full"
      >
        {/* Column tabs - horizontally scrollable */}
        <div className="flex-shrink-0 overflow-x-auto">
          <TabsList className="w-max min-w-full px-2 gap-1">
            {KANBAN_COLUMNS.map((col) => (
              <TabsTrigger
                key={col.id}
                value={col.id}
                className={cn(
                  "flex-shrink-0 gap-1.5 px-2.5 rounded-md",
                  getColumnHeaderColor(col.id),
                )}
              >
                <span className="text-xs">{col.title}</span>
                <span className="text-xs opacity-60 bg-background/50 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                  {columnThreads[col.id].length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Column content */}
        {KANBAN_COLUMNS.map((col) => (
          <TabsContent
            key={col.id}
            value={col.id}
            className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
          >
            <ScrollArea className="h-full">
              <div className="p-3 space-y-3">
                {columnThreads[col.id].length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No tasks in {col.title.toLowerCase()}
                  </div>
                ) : (
                  columnThreads[col.id].map((thread) => (
                    <KanbanCard
                      key={thread.id}
                      thread={thread}
                      isSelected={selectedThreadId === thread.id}
                      onClick={() => handleThreadSelect(thread)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>

      {/* Task detail drawer */}
      <KanbanTaskDrawer
        threadId={selectedThreadId}
        open={!!selectedThreadId}
        onClose={handleCloseDrawer}
      />
    </div>
  );
});
