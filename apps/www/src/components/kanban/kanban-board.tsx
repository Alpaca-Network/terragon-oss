"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
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
  SquarePen,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
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
import { useAtom } from "jotai";
import { kanbanQuickAddBacklogOpenAtom } from "@/atoms/user-cookies";
import { TaskViewToggle } from "@/components/task-view-toggle";
import { usePlatform } from "@/hooks/use-platform";
import { KanbanBoardMobile } from "./kanban-board-mobile";
import { useCollapsibleThreadList } from "@/components/thread-list/use-collapsible-thread-list";
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

// Dynamically import CodeReviewView for the Comments tab
const CodeReviewView = dynamic(
  () =>
    import("@/components/chat/code-review-view").then(
      (mod) => mod.CodeReviewView,
    ),
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
  initialSelectedTaskId,
}: {
  queryFilters: ThreadListFilters;
  initialSelectedTaskId?: string | null;
}) {
  // All hooks must be called unconditionally at the top (React Rules of Hooks)
  const platform = usePlatform();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialSelectedTaskId ?? null,
  );

  // Handle initialSelectedTaskId changes (e.g., when navigating with ?task= param)
  useEffect(() => {
    if (initialSelectedTaskId) {
      setSelectedThreadId(initialSelectedTaskId);
    }
  }, [initialSelectedTaskId]);

  const [activeTab, setActiveTab] = useState<TaskPanelTab>("feed");
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [isQuickAddBacklogOpen, setIsQuickAddBacklogOpen] = useAtom(
    kanbanQuickAddBacklogOpenAtom,
  );
  const [showArchivedInDone, setShowArchivedInDone] = useState(false);
  const [isFullScreenTask, setIsFullScreenTask] = useState(false);
  const [fullScreenColumnIndex, setFullScreenColumnIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Sidebar collapse state
  const {
    canCollapseThreadList,
    isThreadListCollapsed,
    setThreadListCollapsed,
  } = useCollapsibleThreadList();

  // Check scroll state
  const updateScrollState = useCallback(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (scrollContainer) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  }, []);

  // Scroll handlers
  const scrollLeft = useCallback(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (scrollContainer) {
      scrollContainer.scrollBy({ left: -320, behavior: "smooth" });
    }
  }, []);

  const scrollRight = useCallback(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (scrollContainer) {
      scrollContainer.scrollBy({ left: 320, behavior: "smooth" });
    }
  }, []);

  // Update scroll state on mount, resize, and when scrollAreaRef changes
  useEffect(() => {
    // Initial update
    updateScrollState();

    // Set up a MutationObserver to detect when the scroll container becomes available
    const observer = new MutationObserver(() => {
      const scrollContainer = scrollAreaRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        updateScrollState();
        scrollContainer.addEventListener("scroll", updateScrollState);
      }
    });

    if (scrollAreaRef.current) {
      observer.observe(scrollAreaRef.current, {
        childList: true,
        subtree: true,
      });
    }

    const scrollContainer = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", updateScrollState);
    }
    window.addEventListener("resize", updateScrollState);

    return () => {
      observer.disconnect();
      const scrollContainer = scrollAreaRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", updateScrollState);
      }
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

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

  // Fetch backlog threads to show in the Backlog column
  const backlogFilters = useMemo(
    () => ({
      ...queryFilters,
      isBacklog: true,
    }),
    [queryFilters],
  );
  const { data: backlogData, refetch: refetchBacklog } =
    useInfiniteThreadList(backlogFilters);

  const threads = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data],
  );

  const archivedThreads = useMemo(
    () => archivedData?.pages.flatMap((page) => page) ?? [],
    [archivedData],
  );

  const backlogThreads = useMemo(
    () => backlogData?.pages.flatMap((page) => page) ?? [],
    [backlogData],
  );

  const threadIds = useMemo(() => new Set(threads.map((t) => t.id)), [threads]);
  const archivedThreadIds = useMemo(
    () => new Set(archivedThreads.map((t) => t.id)),
    [archivedThreads],
  );
  const backlogThreadIds = useMemo(
    () => new Set(backlogThreads.map((t) => t.id)),
    [backlogThreads],
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

    // Add backlog threads to the Backlog column
    for (const thread of backlogThreads) {
      // Avoid duplicates (threads that might be in both queries)
      if (!threadIds.has(thread.id)) {
        groups.backlog.push(thread);
      }
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
  }, [threads, backlogThreads, threadIds, archivedThreads, showArchivedInDone]);

  const showArchived = queryFilters.archived ?? false;
  const automationId = queryFilters.automationId;

  const matchThread = useCallback(
    (threadId: string, data: BroadcastUserMessage["data"]) => {
      if (
        threadIds.has(threadId) ||
        archivedThreadIds.has(threadId) ||
        backlogThreadIds.has(threadId)
      ) {
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
      // Match backlog threads
      if (typeof data.isThreadBacklog === "boolean") {
        return true;
      }
      if (data.isThreadCreated) {
        return true;
      }
      return false;
    },
    [
      threadIds,
      archivedThreadIds,
      backlogThreadIds,
      showArchived,
      showArchivedInDone,
      automationId,
    ],
  );

  useRealtimeThreadMatch({
    matchThread,
    onThreadChange: () => {
      refetch();
      refetchBacklog();
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
    // Enter full-screen mode and set the column index
    const column = getKanbanColumn(thread);
    const columnIndex = KANBAN_COLUMNS.findIndex((c) => c.id === column);
    setFullScreenColumnIndex(columnIndex >= 0 ? columnIndex : 0);
    setIsFullScreenTask(true);
  }, []);

  const handleThreadCommentsClick = useCallback((thread: ThreadInfo) => {
    setSelectedThreadId(thread.id);
    setActiveTab("comments"); // Open the comments tab directly
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedThreadId(null);
    setIsFullScreenTask(false);
  }, []);

  // Navigate between columns in full-screen mode
  const navigateColumn = useCallback((direction: "left" | "right") => {
    setFullScreenColumnIndex((prev) => {
      const newIndex =
        direction === "left"
          ? Math.max(0, prev - 1)
          : Math.min(KANBAN_COLUMNS.length - 1, prev + 1);
      return newIndex;
    });
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
    return (
      <KanbanBoardMobile
        queryFilters={queryFilters}
        initialSelectedTaskId={initialSelectedTaskId}
      />
    );
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

  // Full-screen task view
  if (isFullScreenTask && selectedThreadId) {
    // Safe to use non-null assertion as fullScreenColumnIndex is clamped to valid range
    const currentColumn = KANBAN_COLUMNS[fullScreenColumnIndex]!;
    return (
      <div
        ref={containerRef}
        className="flex flex-col h-full w-full overflow-hidden"
      >
        {/* Full-screen header */}
        <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Left arrow */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateColumn("left")}
              disabled={fullScreenColumnIndex === 0}
              className="h-8 w-8"
              title="Previous column"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-sm font-medium">
              {currentColumn?.title ?? "Kanban Board"}
            </h2>
            {/* Right arrow */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateColumn("right")}
              disabled={fullScreenColumnIndex === KANBAN_COLUMNS.length - 1}
              className="h-8 w-8"
              title="Next column"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleCloseDetail}
          >
            <X className="h-4 w-4" />
            <span className="text-xs">Close</span>
          </Button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Single column in full-screen mode */}
          <div className="w-full max-w-[400px] min-h-0 overflow-hidden p-4 border-r">
            <KanbanColumn
              column={currentColumn.id}
              threads={columnThreads[currentColumn.id]}
              selectedThreadId={selectedThreadId}
              onThreadSelect={handleThreadSelect}
              onThreadCommentsClick={handleThreadCommentsClick}
              showArchivedToggle={
                currentColumn.id === "done" && !queryFilters.archived
              }
              showArchived={showArchivedInDone}
              onToggleArchived={() =>
                setShowArchivedInDone(!showArchivedInDone)
              }
            />
          </div>

          {/* Task detail panel - full width */}
          <div className="relative flex-1 bg-background flex flex-col min-w-0">
            {/* Panel header with tabs and view toggle */}
            <div className="flex items-center justify-between border-b px-3 py-2 flex-shrink-0">
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
                  <span className="text-xs">Files Changed</span>
                </Button>
                <Button
                  variant={activeTab === "comments" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setActiveTab("comments")}
                  disabled={!selectedThread?.githubPRNumber}
                  title={
                    !selectedThread?.githubPRNumber
                      ? "No PR associated"
                      : undefined
                  }
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="text-xs">Comments</span>
                </Button>
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-1">
                <TaskViewToggle threadId={selectedThreadId} />
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
              {activeTab === "comments" && selectedThread && (
                <div className="h-full overflow-auto">
                  <CodeReviewView thread={selectedThread} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New task dialog */}
        <KanbanNewTaskDialog
          open={newTaskDialogOpen}
          onOpenChange={setNewTaskDialogOpen}
          queryFilters={queryFilters}
        />
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
          {/* Expand sidebar button */}
          {canCollapseThreadList && isThreadListCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setThreadListCollapsed(false)}
              className="h-8 w-8 flex-shrink-0"
              title="Show task list"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-sm font-medium text-muted-foreground">
            Kanban Board
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <TaskViewToggle />
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setNewTaskDialogOpen(true)}
          >
            <SquarePen className="h-4 w-4" />
            <span className="text-xs">New Task</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left scroll arrow */}
        <Button
          variant="ghost"
          size="icon"
          onClick={scrollLeft}
          disabled={!canScrollLeft}
          className={cn(
            "absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/90 shadow-md border transition-opacity",
            canScrollLeft
              ? "opacity-100 hover:bg-background"
              : "opacity-0 pointer-events-none",
          )}
          title="Scroll left"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* Kanban columns */}
        <div
          className={cn(
            "flex-1 min-h-0 overflow-hidden transition-all duration-200",
            selectedThreadId && "min-w-[300px]",
          )}
        >
          <ScrollArea ref={scrollAreaRef} className="h-full w-full">
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
                  onThreadCommentsClick={handleThreadCommentsClick}
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

        {/* Right scroll arrow - positioned dynamically based on panel width */}
        <Button
          variant="ghost"
          size="icon"
          onClick={scrollRight}
          disabled={!canScrollRight}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/90 shadow-md border transition-opacity",
            canScrollRight
              ? "opacity-100 hover:bg-background"
              : "opacity-0 pointer-events-none",
          )}
          style={{
            right: selectedThreadId ? `${panelWidth + 8}px` : "8px",
          }}
          title="Scroll right"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>

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
                  <span className="text-xs">Files Changed</span>
                </Button>
                <Button
                  variant={activeTab === "comments" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => setActiveTab("comments")}
                  disabled={!selectedThread?.githubPRNumber}
                  title={
                    !selectedThread?.githubPRNumber
                      ? "No PR associated"
                      : undefined
                  }
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="text-xs">Comments</span>
                </Button>
              </div>

              {/* View toggle and close button */}
              <div className="flex items-center gap-1">
                <TaskViewToggle threadId={selectedThreadId} />
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
              {activeTab === "comments" && selectedThread && (
                <div className="h-full overflow-auto">
                  <CodeReviewView thread={selectedThread} />
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
