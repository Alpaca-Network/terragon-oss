"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useMemo, useState, useCallback, useRef } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { KanbanColumn } from "./kanban-column";
import {
  KanbanColumn as KanbanColumnType,
  KANBAN_COLUMNS,
  getKanbanColumn,
} from "./types";
import { LoaderCircle, X } from "lucide-react";
import {
  ThreadListFilters,
  useInfiniteThreadList,
} from "@/queries/thread-queries";
import { useRealtimeThreadMatch } from "@/hooks/useRealtime";
import { BroadcastUserMessage } from "@terragon/types/broadcast";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useResizablePanel } from "@/hooks/use-resizable-panel";

// Dynamically import ChatUI to avoid SSR issues
const ChatUI = dynamic(() => import("@/components/chat/chat-ui"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

const TASK_PANEL_MIN_WIDTH = 400;
const TASK_PANEL_MAX_WIDTH_PERCENT = 70;
const TASK_PANEL_DEFAULT_WIDTH_PERCENT = 50;

export const KanbanBoard = memo(function KanbanBoard({
  queryFilters,
}: {
  queryFilters: ThreadListFilters;
}) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    setSelectedThreadId(thread.id);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedThreadId(null);
  }, []);

  // Calculate max width based on container
  const getMaxWidth = useCallback(() => {
    if (containerRef.current) {
      return (
        (containerRef.current.offsetWidth * TASK_PANEL_MAX_WIDTH_PERCENT) / 100
      );
    }
    return 800;
  }, []);

  const getDefaultWidth = useCallback(() => {
    if (containerRef.current) {
      return (
        (containerRef.current.offsetWidth * TASK_PANEL_DEFAULT_WIDTH_PERCENT) /
        100
      );
    }
    return 600;
  }, []);

  const {
    width: panelWidth,
    isResizing,
    handleMouseDown,
  } = useResizablePanel({
    minWidth: TASK_PANEL_MIN_WIDTH,
    maxWidth: getMaxWidth(),
    defaultWidth: getDefaultWidth(),
    mode: "fixed",
    direction: "rtl",
  });

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
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      {/* Kanban columns */}
      <div
        className={cn(
          "flex-1 min-h-0 overflow-hidden transition-all duration-200",
          selectedThreadId && "min-w-[300px]",
        )}
      >
        <ScrollArea className="h-full w-full">
          <div className="flex gap-4 p-4 h-full min-h-[500px]">
            {KANBAN_COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column.id}
                threads={columnThreads[column.id]}
                selectedThreadId={selectedThreadId}
                onThreadSelect={handleThreadSelect}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Task detail panel */}
      {selectedThreadId && (
        <div
          className="relative flex-shrink-0 border-l bg-background"
          style={{ width: `${panelWidth}px` }}
        >
          {/* Resize handle */}
          <div
            className={cn(
              "absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-30",
              isResizing && "bg-primary/50",
            )}
            onMouseDown={handleMouseDown}
          />

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCloseDetail}
            className="absolute top-2 right-2 z-20 h-8 w-8"
            title="Close task details"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* ChatUI */}
          <div className="h-full overflow-hidden">
            <ChatUI threadId={selectedThreadId} isReadOnly={false} />
          </div>
        </div>
      )}
    </div>
  );
});
