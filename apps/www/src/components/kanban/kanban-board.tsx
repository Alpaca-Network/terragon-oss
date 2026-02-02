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
  GitPullRequest,
  SquarePen,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  CheckCircle2,
  BarChart3,
  GitMerge,
  ExternalLink,
  AlertCircle,
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
import { useServerActionQuery } from "@/queries/server-action-helpers";
import { getPRFeedback } from "@/server-actions/get-pr-feedback";
import { createFeedbackSummary } from "@terragon/shared/github/pr-feedback";
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

// Dynamically import PR feedback sections
const PRCommentsSection = dynamic(
  () =>
    import("@/components/chat/code-review/pr-comments-section").then(
      (mod) => mod.PRCommentsSection,
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

const ChecksSection = dynamic(
  () =>
    import("@/components/chat/code-review/checks-section").then(
      (mod) => mod.ChecksSection,
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

const CoverageSection = dynamic(
  () =>
    import("@/components/chat/code-review/coverage-section").then(
      (mod) => mod.CoverageSection,
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

const MergeStatusSection = dynamic(
  () =>
    import("@/components/chat/code-review/merge-status-section").then(
      (mod) => mod.MergeStatusSection,
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

const MergeButton = dynamic(
  () =>
    import("@/components/chat/code-review/merge-button").then(
      (mod) => mod.MergeButton,
    ),
  {
    ssr: false,
    loading: () => null,
  },
);

const AddressFeedbackDialog = dynamic(
  () =>
    import("@/components/chat/code-review/address-feedback-dialog").then(
      (mod) => mod.AddressFeedbackDialog,
    ),
  {
    ssr: false,
    loading: () => null,
  },
);

type TaskPanelTab =
  | "feed"
  | "changes"
  | "comments"
  | "checks"
  | "coverage"
  | "merge";

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
      '[data-slot="scroll-area-viewport"]',
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
      '[data-slot="scroll-area-viewport"]',
    );
    if (scrollContainer) {
      scrollContainer.scrollBy({ left: -320, behavior: "smooth" });
    }
  }, []);

  const scrollRight = useCallback(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]',
    );
    if (scrollContainer) {
      scrollContainer.scrollBy({ left: 320, behavior: "smooth" });
    }
  }, []);

  // Update scroll state on mount, resize, and when scrollAreaRef changes
  useEffect(() => {
    // Copy ref value to local variable for cleanup
    const scrollAreaElement = scrollAreaRef.current;

    // Initial update
    updateScrollState();

    // Set up a MutationObserver to detect when the scroll container becomes available
    const observer = new MutationObserver(() => {
      const scrollContainer = scrollAreaElement?.querySelector(
        '[data-slot="scroll-area-viewport"]',
      );
      if (scrollContainer) {
        updateScrollState();
        scrollContainer.addEventListener("scroll", updateScrollState);
      }
    });

    if (scrollAreaElement) {
      observer.observe(scrollAreaElement, {
        childList: true,
        subtree: true,
      });
    }

    const scrollContainer = scrollAreaElement?.querySelector(
      '[data-slot="scroll-area-viewport"]',
    );
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", updateScrollState);
    }
    window.addEventListener("resize", updateScrollState);

    return () => {
      observer.disconnect();
      const scrollContainer = scrollAreaElement?.querySelector(
        '[data-slot="scroll-area-viewport"]',
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

  // Fetch PR feedback for the PR-related tabs
  const { data: prFeedbackData } = useServerActionQuery({
    queryKey: ["pr-feedback-kanban", selectedThreadId],
    queryFn: () => getPRFeedback({ threadId: selectedThreadId! }),
    enabled: !!selectedThreadId && !!selectedThread?.githubPRNumber,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
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
      <>
        <div className="flex flex-col h-full items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">
            Failed to load tasks. Please try again.
          </p>
          <Button
            variant="default"
            size="sm"
            onClick={() => setNewTaskDialogOpen(true)}
            className="gap-1.5"
          >
            <SquarePen className="h-3.5 w-3.5" />
            New Task
          </Button>
        </div>
        <KanbanNewTaskDialog
          open={newTaskDialogOpen}
          onOpenChange={setNewTaskDialogOpen}
          queryFilters={queryFilters}
        />
      </>
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
              showNavigation={true}
              canNavigateLeft={fullScreenColumnIndex > 0}
              canNavigateRight={
                fullScreenColumnIndex < KANBAN_COLUMNS.length - 1
              }
              onNavigateLeft={() => navigateColumn("left")}
              onNavigateRight={() => navigateColumn("right")}
            />
          </div>

          {/* Task detail panel - full width */}
          <div className="relative flex-1 bg-background flex flex-col min-w-0">
            {/* PR Header - only show when on PR tabs */}
            {selectedThread?.githubPRNumber &&
              prFeedbackData?.feedback &&
              (activeTab === "comments" ||
                activeTab === "checks" ||
                activeTab === "coverage" ||
                activeTab === "merge") && (
                <div className="border-b px-4 py-3 space-y-2 flex-shrink-0">
                  <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <GitMerge className="size-4 flex-shrink-0" />
                      <a
                        href={prFeedbackData.feedback.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline flex items-center gap-1 shrink-0"
                      >
                        #{prFeedbackData.feedback.prNumber}
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <AddressFeedbackDialog
                        feedback={prFeedbackData.feedback}
                        thread={selectedThread}
                      />
                      <MergeButton
                        repoFullName={prFeedbackData.feedback.repoFullName}
                        prNumber={prFeedbackData.feedback.prNumber}
                        prTitle={prFeedbackData.feedback.prTitle}
                        isMergeable={prFeedbackData.feedback.isMergeable}
                        threadId={selectedThread.id}
                        onMerged={() => {}}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {prFeedbackData.feedback.prTitle}
                  </div>
                </div>
              )}

            {/* Panel header with tabs and view toggle */}
            <div className="flex items-center justify-between border-b px-3 py-2 flex-shrink-0">
              {/* Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                <Button
                  variant={activeTab === "feed" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("feed")}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="text-xs">Feed</span>
                </Button>
                <Button
                  variant={activeTab === "changes" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("changes")}
                  disabled={!selectedThread?.gitDiff}
                >
                  <GitCommit className="h-3.5 w-3.5" />
                  <span className="text-xs">Files</span>
                </Button>
                <Button
                  variant={activeTab === "comments" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("comments")}
                  disabled={!selectedThread?.githubPRNumber}
                  title={
                    !selectedThread?.githubPRNumber
                      ? "No PR associated"
                      : undefined
                  }
                >
                  <GitPullRequest className="h-3.5 w-3.5" />
                  <span className="text-xs">Comments</span>
                  {prFeedbackData?.feedback &&
                    createFeedbackSummary(prFeedbackData.feedback)
                      .unresolvedCommentCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                        {
                          createFeedbackSummary(prFeedbackData.feedback)
                            .unresolvedCommentCount
                        }
                      </span>
                    )}
                </Button>
                <Button
                  variant={activeTab === "checks" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("checks")}
                  disabled={!selectedThread?.githubPRNumber}
                  title={
                    !selectedThread?.githubPRNumber
                      ? "No PR associated"
                      : undefined
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs">Checks</span>
                  {prFeedbackData?.feedback &&
                    createFeedbackSummary(prFeedbackData.feedback)
                      .failingCheckCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                        {
                          createFeedbackSummary(prFeedbackData.feedback)
                            .failingCheckCount
                        }
                      </span>
                    )}
                </Button>
                <Button
                  variant={activeTab === "coverage" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("coverage")}
                  disabled={!selectedThread?.githubPRNumber}
                  title={
                    !selectedThread?.githubPRNumber
                      ? "No PR associated"
                      : undefined
                  }
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span className="text-xs">Coverage</span>
                  {prFeedbackData?.feedback &&
                    createFeedbackSummary(prFeedbackData.feedback)
                      .hasCoverageCheck &&
                    !createFeedbackSummary(prFeedbackData.feedback)
                      .coverageCheckPassed && (
                      <span className="ml-1 size-2 rounded-full bg-red-500" />
                    )}
                </Button>
                <Button
                  variant={activeTab === "merge" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("merge")}
                  disabled={!selectedThread?.githubPRNumber}
                  title={
                    !selectedThread?.githubPRNumber
                      ? "No PR associated"
                      : undefined
                  }
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  <span className="text-xs">Merge</span>
                  {prFeedbackData?.feedback &&
                    createFeedbackSummary(prFeedbackData.feedback)
                      .hasConflicts && (
                      <span className="ml-1 size-2 rounded-full bg-red-500" />
                    )}
                </Button>
              </div>

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseDetail}
                className="h-8 w-8 flex-shrink-0"
                title="Close task details"
                aria-label="Close task details"
              >
                <X className="h-4 w-4" />
              </Button>
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
                <div className="h-full overflow-auto p-4">
                  {prFeedbackData?.feedback ? (
                    <PRCommentsSection
                      unresolved={prFeedbackData.feedback.comments.unresolved}
                      resolved={prFeedbackData.feedback.comments.resolved}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <AlertCircle className="size-8 mb-2 opacity-50" />
                      <p className="text-sm">Loading PR feedback...</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "checks" && selectedThread && (
                <div className="h-full overflow-auto p-4">
                  {prFeedbackData?.feedback ? (
                    <ChecksSection checks={prFeedbackData.feedback.checks} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <AlertCircle className="size-8 mb-2 opacity-50" />
                      <p className="text-sm">Loading PR feedback...</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "coverage" && selectedThread && (
                <div className="h-full overflow-auto p-4">
                  {prFeedbackData?.feedback ? (
                    <CoverageSection
                      coverageCheck={prFeedbackData.feedback.coverageCheck}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <AlertCircle className="size-8 mb-2 opacity-50" />
                      <p className="text-sm">Loading PR feedback...</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "merge" && selectedThread && (
                <div className="h-full overflow-auto p-4">
                  {prFeedbackData?.feedback ? (
                    <MergeStatusSection
                      mergeableState={prFeedbackData.feedback.mergeableState}
                      hasConflicts={prFeedbackData.feedback.hasConflicts}
                      isMergeable={prFeedbackData.feedback.isMergeable}
                      baseBranch={prFeedbackData.feedback.baseBranch}
                      headBranch={prFeedbackData.feedback.headBranch}
                      prUrl={prFeedbackData.feedback.prUrl}
                      prNumber={prFeedbackData.feedback.prNumber}
                      repoFullName={prFeedbackData.feedback.repoFullName}
                      thread={selectedThread}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <AlertCircle className="size-8 mb-2 opacity-50" />
                      <p className="text-sm">Loading PR feedback...</p>
                    </div>
                  )}
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

            {/* PR Header - only show when on PR tabs */}
            {selectedThread?.githubPRNumber &&
              prFeedbackData?.feedback &&
              (activeTab === "comments" ||
                activeTab === "checks" ||
                activeTab === "coverage" ||
                activeTab === "merge") && (
                <div className="border-b px-4 py-3 space-y-2 flex-shrink-0">
                  <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <GitMerge className="size-4 flex-shrink-0" />
                      <a
                        href={prFeedbackData.feedback.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline flex items-center gap-1 shrink-0"
                      >
                        #{prFeedbackData.feedback.prNumber}
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <AddressFeedbackDialog
                        feedback={prFeedbackData.feedback}
                        thread={selectedThread}
                      />
                      <MergeButton
                        repoFullName={prFeedbackData.feedback.repoFullName}
                        prNumber={prFeedbackData.feedback.prNumber}
                        prTitle={prFeedbackData.feedback.prTitle}
                        isMergeable={prFeedbackData.feedback.isMergeable}
                        threadId={selectedThread.id}
                        onMerged={() => {}}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {prFeedbackData.feedback.prTitle}
                  </div>
                </div>
              )}

            {/* Panel header with tabs and view toggle */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2 flex-shrink-0">
              {/* Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                <Button
                  variant={activeTab === "feed" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("feed")}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="text-xs">Feed</span>
                </Button>
                <Button
                  variant={activeTab === "changes" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("changes")}
                  disabled={!selectedThread?.gitDiff}
                >
                  <GitCommit className="h-3.5 w-3.5" />
                  <span className="text-xs">Files</span>
                </Button>
                <Button
                  variant={activeTab === "comments" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("comments")}
                  disabled={!selectedThread?.githubPRNumber}
                  title={
                    !selectedThread?.githubPRNumber
                      ? "No PR associated"
                      : undefined
                  }
                >
                  <GitPullRequest className="h-3.5 w-3.5" />
                  <span className="text-xs">Comments</span>
                  {prFeedbackData?.feedback &&
                    createFeedbackSummary(prFeedbackData.feedback)
                      .unresolvedCommentCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                        {
                          createFeedbackSummary(prFeedbackData.feedback)
                            .unresolvedCommentCount
                        }
                      </span>
                    )}
                </Button>
                <Button
                  variant={activeTab === "checks" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("checks")}
                  disabled={!selectedThread?.githubPRNumber}
                  title={
                    !selectedThread?.githubPRNumber
                      ? "No PR associated"
                      : undefined
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs">Checks</span>
                  {prFeedbackData?.feedback &&
                    createFeedbackSummary(prFeedbackData.feedback)
                      .failingCheckCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                        {
                          createFeedbackSummary(prFeedbackData.feedback)
                            .failingCheckCount
                        }
                      </span>
                    )}
                </Button>
                <Button
                  variant={activeTab === "coverage" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("coverage")}
                  disabled={!selectedThread?.githubPRNumber}
                  title={
                    !selectedThread?.githubPRNumber
                      ? "No PR associated"
                      : undefined
                  }
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span className="text-xs">Coverage</span>
                  {prFeedbackData?.feedback &&
                    createFeedbackSummary(prFeedbackData.feedback)
                      .hasCoverageCheck &&
                    !createFeedbackSummary(prFeedbackData.feedback)
                      .coverageCheckPassed && (
                      <span className="ml-1 size-2 rounded-full bg-red-500" />
                    )}
                </Button>
                <Button
                  variant={activeTab === "merge" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3 gap-1.5 flex-shrink-0"
                  onClick={() => setActiveTab("merge")}
                  disabled={!selectedThread?.githubPRNumber}
                  title={
                    !selectedThread?.githubPRNumber
                      ? "No PR associated"
                      : undefined
                  }
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  <span className="text-xs">Merge</span>
                  {prFeedbackData?.feedback &&
                    createFeedbackSummary(prFeedbackData.feedback)
                      .hasConflicts && (
                      <span className="ml-1 size-2 rounded-full bg-red-500" />
                    )}
                </Button>
              </div>

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseDetail}
                className="h-8 w-8 flex-shrink-0"
                title="Close task details"
                aria-label="Close task details"
              >
                <X className="h-4 w-4" />
              </Button>
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
                <div className="h-full overflow-auto p-4">
                  {prFeedbackData?.feedback ? (
                    <PRCommentsSection
                      unresolved={prFeedbackData.feedback.comments.unresolved}
                      resolved={prFeedbackData.feedback.comments.resolved}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <AlertCircle className="size-8 mb-2 opacity-50" />
                      <p className="text-sm">Loading PR feedback...</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "checks" && selectedThread && (
                <div className="h-full overflow-auto p-4">
                  {prFeedbackData?.feedback ? (
                    <ChecksSection checks={prFeedbackData.feedback.checks} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <AlertCircle className="size-8 mb-2 opacity-50" />
                      <p className="text-sm">Loading PR feedback...</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "coverage" && selectedThread && (
                <div className="h-full overflow-auto p-4">
                  {prFeedbackData?.feedback ? (
                    <CoverageSection
                      coverageCheck={prFeedbackData.feedback.coverageCheck}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <AlertCircle className="size-8 mb-2 opacity-50" />
                      <p className="text-sm">Loading PR feedback...</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "merge" && selectedThread && (
                <div className="h-full overflow-auto p-4">
                  {prFeedbackData?.feedback ? (
                    <MergeStatusSection
                      mergeableState={prFeedbackData.feedback.mergeableState}
                      hasConflicts={prFeedbackData.feedback.hasConflicts}
                      isMergeable={prFeedbackData.feedback.isMergeable}
                      baseBranch={prFeedbackData.feedback.baseBranch}
                      headBranch={prFeedbackData.feedback.headBranch}
                      prUrl={prFeedbackData.feedback.prUrl}
                      prNumber={prFeedbackData.feedback.prNumber}
                      repoFullName={prFeedbackData.feedback.repoFullName}
                      thread={selectedThread}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <AlertCircle className="size-8 mb-2 opacity-50" />
                      <p className="text-sm">Loading PR feedback...</p>
                    </div>
                  )}
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
