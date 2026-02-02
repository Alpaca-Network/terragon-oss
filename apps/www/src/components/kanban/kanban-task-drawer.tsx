"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  LoaderCircle,
  X,
  MessageSquare,
  GitCommit,
  Maximize2,
  Minimize2,
  GitPullRequest,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  GitMerge,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  SquarePen,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { threadQueryOptions } from "@/queries/thread-queries";
import { cn } from "@/lib/utils";
import { DataStreamLoader } from "@/components/ui/futuristic-effects";
import { useServerActionQuery } from "@/queries/server-action-helpers";
import { getPRFeedback } from "@/server-actions/get-pr-feedback";
import { PRCommentsSection } from "@/components/chat/code-review/pr-comments-section";
import { ChecksSection } from "@/components/chat/code-review/checks-section";
import { CoverageSection } from "@/components/chat/code-review/coverage-section";
import { MergeStatusSection } from "@/components/chat/code-review/merge-status-section";
import { MergeButton } from "@/components/chat/code-review/merge-button";
import { AddressFeedbackDialog } from "@/components/chat/code-review/address-feedback-dialog";
import { createFeedbackSummary } from "@terragon/shared/github/pr-feedback";
import { SWIPE_THRESHOLD } from "./kanban-board-mobile";

const FuturisticLoader = () => (
  <div className="flex flex-col items-center justify-center h-full gap-4 gradient-shift-bg">
    <div className="relative">
      <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
      <LoaderCircle className="size-8 animate-spin text-primary relative z-10" />
    </div>
    <DataStreamLoader size="md" />
  </div>
);

const ChatUI = dynamic(() => import("@/components/chat/chat-ui"), {
  ssr: false,
  loading: FuturisticLoader,
});

const GitDiffView = dynamic(
  () =>
    import("@/components/chat/git-diff-view").then((mod) => mod.GitDiffView),
  {
    ssr: false,
    loading: FuturisticLoader,
  },
);

type TabType =
  | "feed"
  | "changes"
  | "comments"
  | "checks"
  | "coverage"
  | "merge";

// PR-related tabs for swipe navigation
const PR_TABS: TabType[] = ["comments", "checks", "coverage", "merge"];

// Snap points: 80% and 100% of viewport height
const SNAP_POINTS = [0.8, 1] as const;
const DEFAULT_SNAP_POINT = 0.8;

export const KanbanTaskDrawer = memo(function KanbanTaskDrawer({
  threadId,
  open,
  onClose,
  onNewTaskClick,
  initialTab = "feed",
}: {
  threadId: string | null;
  open: boolean;
  onClose: () => void;
  onNewTaskClick?: () => void;
  initialTab?: TabType;
}) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [currentSnap, setCurrentSnap] = useState<number | string | null>(
    DEFAULT_SNAP_POINT,
  );
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabsListRef = useRef<HTMLDivElement>(null);

  // Swipe gesture tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwiping = useRef(false);

  const { data: thread } = useQuery({
    ...threadQueryOptions(threadId ?? ""),
    enabled: !!threadId,
  });

  const hasPR = thread?.githubPRNumber != null;

  // Fetch PR feedback data when thread has a PR
  const {
    data: prFeedbackData,
    isLoading: isPRFeedbackLoading,
    isError: isPRFeedbackError,
  } = useServerActionQuery({
    queryKey: ["pr-feedback", threadId],
    queryFn: () => getPRFeedback({ threadId: threadId! }),
    enabled: hasPR && !!threadId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  const feedback = prFeedbackData?.feedback;
  const summary = feedback ? createFeedbackSummary(feedback) : null;
  const commentCount = summary?.unresolvedCommentCount ?? 0;
  const failingCheckCount = summary?.failingCheckCount ?? 0;
  const hasConflicts = summary?.hasConflicts ?? false;
  const hasCoverageCheck = summary?.hasCoverageCheck ?? false;
  const coverageCheckPassed = summary?.coverageCheckPassed ?? true;

  // Get available tabs based on whether there's a PR
  const getAvailableTabs = useCallback((): TabType[] => {
    const tabs: TabType[] = ["feed"];
    if (thread?.gitDiff) tabs.push("changes");
    if (hasPR) tabs.push("comments", "checks", "coverage", "merge");
    return tabs;
  }, [thread?.gitDiff, hasPR]);

  // Get the index of current tab in available tabs
  const getTabIndex = useCallback(
    (tab: TabType): number => {
      return getAvailableTabs().indexOf(tab);
    },
    [getAvailableTabs],
  );

  // Swipe to adjacent tab
  const swipeToAdjacentTab = useCallback(
    (direction: "left" | "right") => {
      const availableTabs = getAvailableTabs();
      const currentIndex = getTabIndex(activeTab);
      const newIndex =
        direction === "left"
          ? Math.min(currentIndex + 1, availableTabs.length - 1)
          : Math.max(currentIndex - 1, 0);

      if (newIndex !== currentIndex && availableTabs[newIndex]) {
        setActiveTab(availableTabs[newIndex]);
      }
    },
    [activeTab, getTabIndex, getAvailableTabs],
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

  // Scroll active tab into view when it changes
  useEffect(() => {
    if (tabsListRef.current) {
      const tabsList = tabsListRef.current;
      const activeTabElement = tabsList.querySelector(
        `[data-active="true"]`,
      ) as HTMLElement | null;
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeTab]);

  // Sync activeTab with initialTab when drawer opens
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  // Clear any pending reset timeout on unmount or when drawer opens
  useEffect(() => {
    if (open && resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, [open]);

  // Reset tab and snap point when drawer closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      // Clear any existing timeout before setting a new one
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      // Delay reset until after drawer close animation (~300ms)
      resetTimeoutRef.current = setTimeout(() => {
        setActiveTab("feed");
        setCurrentSnap(DEFAULT_SNAP_POINT);
        resetTimeoutRef.current = null;
      }, 300);
    }
  };

  const isMaximized = currentSnap === 1;

  const toggleMaximize = useCallback(() => {
    setCurrentSnap(isMaximized ? 0.8 : 1);
  }, [isMaximized]);

  // Determine height class based on current snap point
  const getHeightClass = () => {
    if (currentSnap === 1) {
      return "h-[100dvh] max-h-[100dvh]";
    }
    return "h-[80dvh] max-h-[80dvh]";
  };

  const isPRTab = PR_TABS.includes(activeTab);
  const availableTabs = getAvailableTabs();
  const currentTabIndex = getTabIndex(activeTab);
  const canSwipeLeft = currentTabIndex < availableTabs.length - 1;
  const canSwipeRight = currentTabIndex > 0;

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      snapPoints={SNAP_POINTS as unknown as (number | string)[]}
      activeSnapPoint={currentSnap}
      setActiveSnapPoint={setCurrentSnap}
      fadeFromIndex={0}
    >
      <DrawerContent
        className={cn(
          getHeightClass(),
          "rounded-t-2xl border-t-0",
          "bg-background/95 backdrop-blur-md",
          "shadow-[0_-10px_40px_rgba(0,0,0,0.1)]",
          "dark:shadow-[0_-10px_40px_rgba(0,0,0,0.3)]",
        )}
      >
        {/* Drawer handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* PR Header - only show when on PR tabs */}
        {hasPR && feedback && isPRTab && (
          <div className="border-b border-border/50 px-4 py-2 flex-shrink-0 bg-background/50">
            <div className="flex items-center justify-between gap-2 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <GitMerge className="size-4 flex-shrink-0" />
                <a
                  href={feedback.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline flex items-center gap-1 shrink-0"
                >
                  #{feedback.prNumber}
                  <ExternalLink className="size-3" />
                </a>
                <span className="text-xs text-muted-foreground truncate">
                  {feedback.prTitle}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <AddressFeedbackDialog feedback={feedback} thread={thread!} />
                <MergeButton
                  repoFullName={feedback.repoFullName}
                  prNumber={feedback.prNumber}
                  prTitle={feedback.prTitle}
                  isMergeable={feedback.isMergeable}
                  threadId={thread!.id}
                  onMerged={() => {}}
                />
              </div>
            </div>
          </div>
        )}

        <DrawerHeader className="flex flex-row items-center justify-between border-b border-border/50 py-2 px-2 flex-shrink-0 bg-background/50">
          {/* Navigation arrows and tabs */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={() => swipeToAdjacentTab("right")}
              disabled={!canSwipeRight}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div
              ref={tabsListRef}
              className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1"
            >
              <Button
                variant={activeTab === "feed" ? "secondary" : "ghost"}
                size="sm"
                data-active={activeTab === "feed"}
                className={cn(
                  "h-8 px-2.5 gap-1.5 rounded-lg tap-highlight transition-all duration-200 flex-shrink-0",
                  activeTab === "feed" &&
                    "shadow-[0_0_12px_rgba(99,102,241,0.15)]",
                )}
                onClick={() => setActiveTab("feed")}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Feed</span>
              </Button>
              {thread?.gitDiff && (
                <Button
                  variant={activeTab === "changes" ? "secondary" : "ghost"}
                  size="sm"
                  data-active={activeTab === "changes"}
                  className={cn(
                    "h-8 px-2.5 gap-1.5 rounded-lg tap-highlight transition-all duration-200 flex-shrink-0",
                    activeTab === "changes" &&
                      "shadow-[0_0_12px_rgba(99,102,241,0.15)]",
                  )}
                  onClick={() => setActiveTab("changes")}
                >
                  <GitCommit className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Files</span>
                </Button>
              )}
              {hasPR && (
                <>
                  <Button
                    variant={activeTab === "comments" ? "secondary" : "ghost"}
                    size="sm"
                    data-active={activeTab === "comments"}
                    className={cn(
                      "h-8 px-2.5 gap-1.5 rounded-lg tap-highlight transition-all duration-200 flex-shrink-0",
                      activeTab === "comments" &&
                        "shadow-[0_0_12px_rgba(99,102,241,0.15)]",
                    )}
                    onClick={() => setActiveTab("comments")}
                  >
                    <GitPullRequest className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Comments</span>
                    {commentCount > 0 && (
                      <span className="px-1 py-0.5 text-[10px] rounded-full bg-accent/10 text-accent-foreground">
                        {commentCount}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant={activeTab === "checks" ? "secondary" : "ghost"}
                    size="sm"
                    data-active={activeTab === "checks"}
                    className={cn(
                      "h-8 px-2.5 gap-1.5 rounded-lg tap-highlight transition-all duration-200 flex-shrink-0",
                      activeTab === "checks" &&
                        "shadow-[0_0_12px_rgba(99,102,241,0.15)]",
                    )}
                    onClick={() => setActiveTab("checks")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Checks</span>
                    {failingCheckCount > 0 && (
                      <span className="px-1 py-0.5 text-[10px] rounded-full bg-destructive/10 text-destructive-foreground">
                        {failingCheckCount}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant={activeTab === "coverage" ? "secondary" : "ghost"}
                    size="sm"
                    data-active={activeTab === "coverage"}
                    className={cn(
                      "h-8 px-2.5 gap-1.5 rounded-lg tap-highlight transition-all duration-200 flex-shrink-0",
                      activeTab === "coverage" &&
                        "shadow-[0_0_12px_rgba(99,102,241,0.15)]",
                    )}
                    onClick={() => setActiveTab("coverage")}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Coverage</span>
                    {hasCoverageCheck && !coverageCheckPassed && (
                      <span className="size-2 rounded-full bg-destructive" />
                    )}
                  </Button>
                  <Button
                    variant={activeTab === "merge" ? "secondary" : "ghost"}
                    size="sm"
                    data-active={activeTab === "merge"}
                    className={cn(
                      "h-8 px-2.5 gap-1.5 rounded-lg tap-highlight transition-all duration-200 flex-shrink-0",
                      activeTab === "merge" &&
                        "shadow-[0_0_12px_rgba(99,102,241,0.15)]",
                    )}
                    onClick={() => setActiveTab("merge")}
                  >
                    <GitMerge className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Merge</span>
                    {hasConflicts && (
                      <span className="size-2 rounded-full bg-destructive" />
                    )}
                  </Button>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={() => swipeToAdjacentTab("left")}
              disabled={!canSwipeLeft}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMaximize}
              className="h-8 w-8 rounded-lg tap-highlight hover:bg-primary/10 transition-colors"
              aria-label={isMaximized ? "Minimize" : "Maximize"}
            >
              {isMaximized ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            {onNewTaskClick && (
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1.5"
                onClick={onNewTaskClick}
                title="Create new task"
                aria-label="Create new task"
              >
                <SquarePen className="h-4 w-4" />
                <span className="text-xs">New Task</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-lg tap-highlight hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label="Close task details"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div
          className="flex-1 overflow-hidden min-h-0 flex flex-col gradient-shift-bg"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {threadId && activeTab === "feed" && (
            <div className="animate-page-enter flex-1 flex flex-col min-h-0">
              <ChatUI threadId={threadId} isReadOnly={false} />
            </div>
          )}
          {thread && activeTab === "changes" && (
            <div className="h-full overflow-auto animate-page-enter futuristic-scrollbar">
              <GitDiffView thread={thread} />
            </div>
          )}
          {activeTab === "comments" && (
            <div className="h-full overflow-auto animate-page-enter futuristic-scrollbar p-4">
              {isPRFeedbackLoading ? (
                <FuturisticLoader />
              ) : isPRFeedbackError ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="size-8 mb-2 text-destructive opacity-70" />
                  <p className="text-sm">Failed to load PR comments</p>
                </div>
              ) : feedback ? (
                <PRCommentsSection
                  unresolved={feedback.comments.unresolved}
                  resolved={feedback.comments.resolved}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <GitPullRequest className="size-8 mb-2 opacity-50" />
                  <p className="text-sm">No PR associated with this task</p>
                </div>
              )}
            </div>
          )}
          {activeTab === "checks" && (
            <div className="h-full overflow-auto animate-page-enter futuristic-scrollbar p-4">
              {isPRFeedbackLoading ? (
                <FuturisticLoader />
              ) : isPRFeedbackError ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="size-8 mb-2 text-destructive opacity-70" />
                  <p className="text-sm">Failed to load PR checks</p>
                </div>
              ) : feedback ? (
                <ChecksSection checks={feedback.checks} />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle2 className="size-8 mb-2 opacity-50" />
                  <p className="text-sm">No PR associated with this task</p>
                </div>
              )}
            </div>
          )}
          {activeTab === "coverage" && (
            <div className="h-full overflow-auto animate-page-enter futuristic-scrollbar p-4">
              {isPRFeedbackLoading ? (
                <FuturisticLoader />
              ) : isPRFeedbackError ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="size-8 mb-2 text-destructive opacity-70" />
                  <p className="text-sm">Failed to load coverage info</p>
                </div>
              ) : feedback ? (
                <CoverageSection coverageCheck={feedback.coverageCheck} />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <BarChart3 className="size-8 mb-2 opacity-50" />
                  <p className="text-sm">No PR associated with this task</p>
                </div>
              )}
            </div>
          )}
          {activeTab === "merge" && (
            <div className="h-full overflow-auto animate-page-enter futuristic-scrollbar p-4">
              {isPRFeedbackLoading ? (
                <FuturisticLoader />
              ) : isPRFeedbackError ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="size-8 mb-2 text-destructive opacity-70" />
                  <p className="text-sm">Failed to load merge status</p>
                </div>
              ) : feedback && thread ? (
                <MergeStatusSection
                  mergeableState={feedback.mergeableState}
                  hasConflicts={feedback.hasConflicts}
                  isMergeable={feedback.isMergeable}
                  baseBranch={feedback.baseBranch}
                  headBranch={feedback.headBranch}
                  prUrl={feedback.prUrl}
                  prNumber={feedback.prNumber}
                  repoFullName={feedback.repoFullName}
                  thread={thread}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <GitMerge className="size-8 mb-2 opacity-50" />
                  <p className="text-sm">No PR associated with this task</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
});
