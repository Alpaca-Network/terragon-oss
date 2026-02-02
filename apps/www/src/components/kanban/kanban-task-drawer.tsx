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
  MessageCircle,
  AlertCircle,
  XCircle,
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
import { createFeedbackSummary } from "@terragon/shared/github/pr-feedback";

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

type TabType = "feed" | "changes" | "comments";

// Snap points: 80% and 100% of viewport height
const SNAP_POINTS = [0.8, 1] as const;
const DEFAULT_SNAP_POINT = 0.8;

export const KanbanTaskDrawer = memo(function KanbanTaskDrawer({
  threadId,
  open,
  onClose,
  initialTab = "feed",
}: {
  threadId: string | null;
  open: boolean;
  onClose: () => void;
  initialTab?: TabType;
}) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [currentSnap, setCurrentSnap] = useState<number | string | null>(
    DEFAULT_SNAP_POINT,
  );
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

        <DrawerHeader className="flex flex-row items-center justify-between border-b border-border/50 py-2 px-3 flex-shrink-0 bg-background/50">
          <div className="flex items-center gap-1.5">
            <Button
              variant={activeTab === "feed" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-9 px-3.5 gap-2 rounded-lg tap-highlight transition-all duration-200",
                activeTab === "feed" &&
                  "shadow-[0_0_12px_rgba(99,102,241,0.15)]",
              )}
              onClick={() => setActiveTab("feed")}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs font-medium">Feed</span>
            </Button>
            <Button
              variant={activeTab === "changes" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-9 px-3.5 gap-2 rounded-lg tap-highlight transition-all duration-200",
                activeTab === "changes" &&
                  "shadow-[0_0_12px_rgba(99,102,241,0.15)]",
              )}
              onClick={() => setActiveTab("changes")}
              disabled={!thread?.gitDiff}
            >
              <GitCommit className="h-4 w-4" />
              <span className="text-xs font-medium">Changes</span>
            </Button>
            <Button
              variant={activeTab === "comments" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-9 px-3.5 gap-2 rounded-lg tap-highlight transition-all duration-200",
                activeTab === "comments" &&
                  "shadow-[0_0_12px_rgba(99,102,241,0.15)]",
              )}
              onClick={() => setActiveTab("comments")}
              disabled={!hasPR}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Code Review</span>
              {hasConflicts && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-0.5">
                  <AlertCircle className="h-3 w-3" />
                </span>
              )}
              {failingCheckCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-0.5">
                  <XCircle className="h-3 w-3" />
                  {failingCheckCount}
                </span>
              )}
              {commentCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-accent/10 text-accent-foreground border border-accent/20">
                  {commentCount}
                </span>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMaximize}
              className="h-9 w-9 rounded-lg tap-highlight hover:bg-primary/10 transition-colors"
              aria-label={isMaximized ? "Minimize" : "Maximize"}
            >
              {isMaximized ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-lg tap-highlight hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label="Close task details"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden min-h-0 flex flex-col gradient-shift-bg">
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
                  <MessageCircle className="size-8 mb-2 opacity-50" />
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
