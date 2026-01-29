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
import {
  LoaderCircle,
  X,
  MessageSquare,
  GitCommit,
  MessageCircle,
  LayoutList,
  Plus,
  List,
} from "lucide-react";
import { KanbanNewTaskDialog } from "./kanban-new-task-dialog";
import {
  ThreadListFilters,
  useInfiniteThreadList,
  threadQueryOptions,
} from "@/queries/thread-queries";
import { useRealtimeThreadMatch } from "@/hooks/useRealtime";
import { BroadcastUserMessage } from "@terragon/types/broadcast";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { useQuery } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import {
  dashboardViewModeAtom,
  kanbanQuickAddBacklogOpenAtom,
} from "@/atoms/user-cookies";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePlatform } from "@/hooks/use-platform";
import { KanbanBoardMobile } from "./kanban-board-mobile";
import { QuickAddBacklogDialog } from "./quick-add-backlog";

// Dynamically import ChatUI to avoid SSR issues
const ChatUI = dynamic(() => import("@/components/chat/chat-ui"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

// Dynamically import GitDiffView for the Changes tab
const GitDiffView = dynamic(
  () =>
    import("@/components/chat/git-diff-view").then((mod) => mod.GitDiffView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

type TaskPanelTab = "feed" | "changes" | "comments";

const TASK_PANEL_MIN_WIDTH = 500;
const TASK_PANEL_MAX_WIDTH_PERCENT = 75;
const TASK_PANEL_DEFAULT_WIDTH_PERCENT = 55;

export const KanbanBoard = memo(function KanbanBoard({
  queryFilters,
}: {
  queryFilters: ThreadListFilters;
}) {
  // All hooks must be called unconditionally at the top (React Rules of Hooks)
  const platform = usePlatform();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TaskPanelTab>("feed");
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [isQuickAddBacklogOpen, setIsQuickAddBacklogOpen] = useAtom(
    kanbanQuickAddBacklogOpenAtom,
  );
  const [showArchivedInDone, setShowArchivedInDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const setViewMode = useSetAtom(dashboardViewModeAtom);

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

  const showArchived = queryFilters.archived ?? false;
  const automationId = queryFilters.automationId;

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

  // Fetch full thread data for the selected thread (needed for Changes tab)
  const { data: selectedThread } = useQuery({
    ...threadQueryOptions(selectedThreadId ?? ""),
    enabled: !!selectedThreadId,
  });

  const handleThreadSelect = useCallback((thread: ThreadInfo) => {
    setSelectedThreadId(thread.id);
    setActiveTab("feed"); // Reset to feed tab when selecting a new thread
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedThreadId(null);
  }, []);

  const handleOpenQuickAddBacklog = useCallback(() => {
    setIsQuickAddBacklogOpen(true);
  }, [setIsQuickAddBacklogOpen]);

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

  // Render mobile version on mobile devices (after all hooks are called)
  if (platform === "mobile") {
    return <KanbanBoardMobile queryFilters={queryFilters} />;
  }

  // Show loading state while platform is being determined to avoid flash
  if (platform === "unknown") {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
    <div
      ref={containerRef}
      className="flex flex-col h-full w-full overflow-hidden"
    >
      {/* Header with view toggle and new task button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Kanban Board
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode("list")}
                className="h-8 w-8"
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Switch to List view</TooltipContent>
          </Tooltip>
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setNewTaskDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs">New Task</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
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
                  onAddToBacklog={
                    column.id === "backlog"
                      ? handleOpenQuickAddBacklog
                      : undefined
                  }
                  showArchivedToggle={
                    column.id === "done" && !queryFilters.archived
                  }
                  showArchived={showArchivedInDone}
                  onToggleArchived={() =>
                    setShowArchivedInDone(!showArchivedInDone)
                  }
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Task detail panel */}
        {selectedThreadId && (
          <div
            className="relative flex-shrink-0 border-l border-border bg-background flex flex-col"
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

            {/* Panel header with tabs and view toggle */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2 flex-shrink-0">
              {/* Tabs */}
              <div className="flex items-center gap-1">
                <Button
                  variant={activeTab === "feed" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setActiveTab("feed")}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="text-xs">Feed</span>
                </Button>
                <Button
                  variant={activeTab === "changes" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setActiveTab("changes")}
                  disabled={!selectedThread?.gitDiff}
                >
                  <GitCommit className="h-3.5 w-3.5" />
                  <span className="text-xs">Changes</span>
                </Button>
                <Button
                  variant={activeTab === "comments" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setActiveTab("comments")}
                  disabled
                  title="Coming soon"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="text-xs">Comments</span>
                </Button>
              </div>

              {/* View toggle and close button */}
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewMode("list")}
                      className="h-8 w-8"
                    >
                      <LayoutList className="h-4 w-4 opacity-50" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Switch to List view
                  </TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseDetail}
                  className="h-8 w-8"
                  title="Close task details"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "feed" && (
                <ChatUI threadId={selectedThreadId} isReadOnly={false} />
              )}
              {activeTab === "changes" && selectedThread && (
                <div className="h-full overflow-auto">
                  <GitDiffView thread={selectedThread} />
                </div>
              )}
              {activeTab === "comments" && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm">Comments coming soon</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New task dialog */}
      <KanbanNewTaskDialog
        open={newTaskDialogOpen}
        onOpenChange={setNewTaskDialogOpen}
        queryFilters={queryFilters}
      />

      {/* Quick add backlog dialog */}
      <QuickAddBacklogDialog
        open={isQuickAddBacklogOpen}
        onOpenChange={setIsQuickAddBacklogOpen}
      />
    </div>
  );
});
