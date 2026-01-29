"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  LoaderCircle,
  RefreshCw,
  Plus,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanCard } from "./kanban-card";
import { KanbanTaskDrawer } from "./kanban-task-drawer";
import { KanbanNewTaskDrawer } from "./kanban-new-task-drawer";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Minimum swipe distance required to trigger tab change
const SWIPE_THRESHOLD = 50;

export const KanbanBoardMobile = memo(function KanbanBoardMobile({
  queryFilters,
}: {
  queryFilters: ThreadListFilters;
}) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] =
    useState<KanbanColumnType>("in_progress");
  const [newTaskDrawerOpen, setNewTaskDrawerOpen] = useState(false);
  const [showArchivedInDone, setShowArchivedInDone] = useState(false);

  // Ref for tab list to scroll to center
  const tabsListRef = useRef<HTMLDivElement>(null);

  // Swipe gesture tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwiping = useRef(false);

  const showArchived = queryFilters.archived ?? false;
  const automationId = queryFilters.automationId;

  const { data, isLoading, isError, refetch } =
    useInfiniteThreadList(queryFilters);

  // Fetch archived threads when showing archived in Done column
  const archivedFilters = useMemo(
    () => ({
      ...queryFilters,
      archived: true,
    }),
    [queryFilters],
  );
  const { data: archivedData, refetch: refetchArchived } =
    useInfiniteThreadList(archivedFilters);

  const threads = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data],
  );

  const archivedThreads = useMemo(
    () => archivedData?.pages.flatMap((page) => page) ?? [],
    [archivedData],
  );

  const threadIds = useMemo(() => new Set(threads.map((t) => t.id)), [threads]);
  const archivedThreadIds = useMemo(
    () => new Set(archivedThreads.map((t) => t.id)),
    [archivedThreads],
  );

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

    // Add archived threads to Done column if toggle is enabled
    if (showArchivedInDone) {
      for (const thread of archivedThreads) {
        const column = getKanbanColumn(thread);
        // Only add archived threads that would be in the Done column
        if (column === "done") {
          groups.done.push(thread);
        }
      }
    }

    // Sort each column by updatedAt (most recent first)
    for (const column of Object.keys(groups) as KanbanColumnType[]) {
      groups[column].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    return groups;
  }, [threads, archivedThreads, showArchivedInDone]);

  const matchThread = useCallback(
    (threadId: string, data: BroadcastUserMessage["data"]) => {
      if (threadIds.has(threadId) || archivedThreadIds.has(threadId)) {
        if (data.messagesUpdated && !data.threadStatusUpdated) {
          return false;
        }
        return true;
      }
      if (automationId && data.threadAutomationId !== automationId) {
        return false;
      }
      if (typeof data.isThreadArchived === "boolean") {
        // Match both archived and non-archived based on current filters and toggle state
        if (showArchived === data.isThreadArchived) {
          return true;
        }
        // Also match archived threads when showArchivedInDone is enabled
        if (showArchivedInDone && data.isThreadArchived) {
          return true;
        }
      }
      if (data.isThreadCreated) {
        return true;
      }
      return false;
    },
    [
      threadIds,
      archivedThreadIds,
      showArchived,
      showArchivedInDone,
      automationId,
    ],
  );

  useRealtimeThreadMatch({
    matchThread,
    onThreadChange: () => {
      refetch();
      if (showArchivedInDone) {
        refetchArchived();
      }
    },
  });

  const handleThreadSelect = useCallback((thread: ThreadInfo) => {
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

  // Scroll active tab to center when it changes
  useEffect(() => {
    if (tabsListRef.current) {
      const tabsList = tabsListRef.current;
      const activeTab = tabsList.querySelector(
        `[data-state="active"]`,
      ) as HTMLElement | null;
      if (activeTab) {
        const tabsListRect = tabsList.getBoundingClientRect();
        const activeTabRect = activeTab.getBoundingClientRect();
        const scrollLeft =
          activeTab.offsetLeft -
          tabsListRect.width / 2 +
          activeTabRect.width / 2;
        tabsList.scrollTo({
          left: scrollLeft,
          behavior: "smooth",
        });
      }
    }
  }, [activeColumn]);

  // Get the column index for the given column ID
  const getColumnIndex = useCallback((columnId: KanbanColumnType): number => {
    return KANBAN_COLUMNS.findIndex((col) => col.id === columnId);
  }, []);

  // Swipe to adjacent tab
  const swipeToAdjacentTab = useCallback(
    (direction: "left" | "right") => {
      const currentIndex = getColumnIndex(activeColumn);
      const newIndex =
        direction === "left"
          ? Math.min(currentIndex + 1, KANBAN_COLUMNS.length - 1)
          : Math.max(currentIndex - 1, 0);

      if (newIndex !== currentIndex && KANBAN_COLUMNS[newIndex]) {
        setActiveColumn(KANBAN_COLUMNS[newIndex].id);
      }
    },
    [activeColumn, getColumnIndex],
  );

  // Touch event handlers for swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    // Determine if this is a horizontal swipe (vs vertical scroll)
    // Only consider it a swipe if horizontal movement is greater than vertical
    if (
      !isSwiping.current &&
      Math.abs(deltaX) > Math.abs(deltaY) &&
      Math.abs(deltaX) > 10
    ) {
      isSwiping.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartX.current;

      // Only trigger if it was a horizontal swipe and exceeds threshold
      if (isSwiping.current && Math.abs(deltaX) >= SWIPE_THRESHOLD) {
        if (deltaX < 0) {
          // Swiped left -> go to next tab
          swipeToAdjacentTab("left");
        } else {
          // Swiped right -> go to previous tab
          swipeToAdjacentTab("right");
        }
      }

      // Reset tracking
      touchStartX.current = null;
      touchStartY.current = null;
      isSwiping.current = false;
    },
    [swipeToAdjacentTab],
  );

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
        {/* Column tabs - horizontally scrollable with new task button */}
        <div className="flex-shrink-0 flex items-center gap-2 px-2">
          <div
            ref={tabsListRef}
            className="flex-1 overflow-x-auto scrollbar-hide"
          >
            <TabsList className="w-max min-w-full gap-1">
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
                  <span className="text-xs opacity-60 bg-muted px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {columnThreads[col.id].length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <Button
            variant="default"
            size="sm"
            className="flex-shrink-0 h-8 px-2.5 gap-1"
            onClick={handleOpenNewTaskDrawer}
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs">New</span>
          </Button>
        </div>

        {/* Column content with swipe support */}
        {KANBAN_COLUMNS.map((col) => (
          <TabsContent
            key={col.id}
            value={col.id}
            className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <ScrollArea className="h-full">
              <div className="p-3 space-y-3">
                {/* Show archived toggle for Done column */}
                {col.id === "done" && !queryFilters.archived && (
                  <div className="flex items-center justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={showArchivedInDone ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 px-2 gap-1.5 text-xs"
                          onClick={() =>
                            setShowArchivedInDone(!showArchivedInDone)
                          }
                        >
                          {showArchivedInDone ? (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                          {showArchivedInDone
                            ? "Hide Archived"
                            : "Show Archived"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {showArchivedInDone
                          ? "Hide archived tasks"
                          : "Show archived tasks in Done column"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
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

      {/* New task drawer */}
      <KanbanNewTaskDrawer
        open={newTaskDrawerOpen}
        onClose={handleCloseNewTaskDrawer}
        queryFilters={queryFilters}
      />
    </div>
  );
});
