"use client";

import React from "react";
import { useAtom } from "jotai";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { ThreadInfoFull } from "@terragon/shared";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { GitDiffView } from "./git-diff-view";
import { usePlatform } from "@/hooks/use-platform";
import { useSecondaryPanel } from "./hooks";
import { secondaryPanelViewAtom } from "@/atoms/user-cookies";
import { SecondaryPanelView } from "@/lib/cookies";
import {
  FileDiff,
  MessageSquare,
  CheckCircle2,
  BarChart3,
  GitMerge,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { PRCommentsSection } from "./code-review/pr-comments-section";
import { ChecksSection } from "./code-review/checks-section";
import { CoverageSection } from "./code-review/coverage-section";
import { MergeStatusSection } from "./code-review/merge-status-section";
import { MergeButton } from "./code-review/merge-button";
import { AddressFeedbackDialog } from "./code-review/address-feedback-dialog";
import {
  usePRFeedback,
  combinePRFeedbackFromQueries,
} from "@/hooks/use-pr-feedback";
import {
  PRHeaderSkeleton,
  CommentsSkeleton,
  ChecksSkeleton,
  CoverageSkeleton,
  MergeStatusSkeleton,
} from "./code-review/skeletons";
import {
  getMergeablePollingInterval,
  nextMergeablePollingState,
  type MergeablePollingState,
} from "@/lib/mergeable-polling";

const SECONDARY_PANEL_MIN_WIDTH = 300;
const SECONDARY_PANEL_MAX_WIDTH_PERCENTAGE = 0.7;
const SECONDARY_PANEL_DEFAULT_WIDTH = 0.5;

export function SecondaryPanel({
  thread,
  containerRef,
}: {
  thread: ThreadInfoFull;
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const platform = usePlatform();
  const {
    isSecondaryPanelOpen: isOpen,
    setIsSecondaryPanelOpen: onOpenChange,
  } = useSecondaryPanel();
  const { width, isResizing, handleMouseDown } = useResizablePanel({
    minWidth: SECONDARY_PANEL_MIN_WIDTH,
    maxWidth: SECONDARY_PANEL_MAX_WIDTH_PERCENTAGE,
    defaultWidth: SECONDARY_PANEL_DEFAULT_WIDTH,
    mode: "percentage",
    direction: "rtl",
    containerRef,
    enabled: isOpen && platform === "desktop",
  });
  if (platform === "mobile") {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[85dvh] rounded-t-2xl bg-background/95 backdrop-blur-md">
          <SecondaryPanelContent thread={thread} />
        </DrawerContent>
      </Drawer>
    );
  }
  if (!isOpen) return null;
  return (
    <>
      <div
        className={cn(
          "w-1.5 cursor-col-resize hover:bg-blue-500/50 transition-colors flex-shrink-0",
          isResizing && "bg-blue-500/50",
        )}
        onMouseDown={handleMouseDown}
      />
      <div
        className="flex-shrink-0 border-l bg-background flex flex-col h-full"
        style={{ width: `${width}px` }}
      >
        <SecondaryPanelContent thread={thread} />
      </div>
    </>
  );
}

interface TabConfig {
  value: SecondaryPanelView;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  requiresPR?: boolean;
}

function ViewTab({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap tap-highlight",
        active
          ? "bg-primary/10 text-primary shadow-[0_0_10px_rgba(99,102,241,0.1)]"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-95",
      )}
    >
      {children}
      {badge}
    </button>
  );
}

function SecondaryPanelContent({ thread }: { thread?: ThreadInfoFull }) {
  const [activeView, setActiveView] = useAtom(secondaryPanelViewAtom);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const mergeablePollingRef = React.useRef<MergeablePollingState>({
    until: null,
    count: 0,
  });
  const lastDataUpdatedAtRef = React.useRef(0);

  const hasPR =
    thread?.githubPRNumber !== null && thread?.githubPRNumber !== undefined;

  // Use the new progressive loading hook with default interval
  // Dynamic polling for mergeable state is managed via effect below
  const { header, comments, checks, summary, isLoading } = usePRFeedback(
    thread?.id ?? "",
    {
      enabled: hasPR && !!thread,
      refreshKey,
      staleTime: 30000,
      refetchInterval: 60000, // Default interval, dynamic polling handled via refreshKey
    },
  );

  const headerData = header.data;

  // Combine data for AddressFeedbackDialog
  const feedback = combinePRFeedbackFromQueries(
    headerData,
    comments.data,
    checks.data,
  );

  // Dynamic polling for mergeable state - trigger faster refetches when state is unknown
  React.useEffect(() => {
    if (header.dataUpdatedAt === lastDataUpdatedAtRef.current) {
      return;
    }
    lastDataUpdatedAtRef.current = header.dataUpdatedAt;
    mergeablePollingRef.current = nextMergeablePollingState({
      mergeableState: headerData?.mergeableState,
      now: Date.now(),
      state: mergeablePollingRef.current,
    });

    // If we need faster polling for unknown mergeable state, set up a timer
    if (headerData?.mergeableState === "unknown") {
      const interval = getMergeablePollingInterval({
        mergeableState: headerData.mergeableState,
        now: Date.now(),
        state: mergeablePollingRef.current,
        defaultIntervalMs: 60000,
      });

      if (interval < 60000) {
        const timer = setTimeout(() => {
          setRefreshKey((k) => k + 1);
        }, interval);
        return () => clearTimeout(timer);
      }
    }
  }, [headerData?.mergeableState, header.dataUpdatedAt]);

  if (!thread) {
    return null;
  }

  // Calculate badge counts from summary
  const commentCount = summary?.unresolvedCommentCount ?? 0;
  const failingCheckCount = summary?.failingCheckCount ?? 0;
  const hasCoverage = summary?.hasCoverageCheck ?? false;
  const coverageCheckPassed = summary?.coverageCheckPassed ?? true;
  const hasConflicts = summary?.hasConflicts ?? false;

  // Build tabs configuration
  const tabs: TabConfig[] = [
    {
      value: "files-changed",
      label: "Files",
      icon: <FileDiff className="size-3.5" />,
    },
  ];

  // Only show PR tabs if thread has a PR
  if (hasPR) {
    tabs.push(
      {
        value: "comments",
        label: "Comments",
        icon: <MessageSquare className="size-3.5" />,
        badge:
          commentCount > 0 ? (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-accent/10 text-accent-foreground border border-accent/20">
              {commentCount}
            </span>
          ) : undefined,
        requiresPR: true,
      },
      {
        value: "checks",
        label: "Checks",
        icon: <CheckCircle2 className="size-3.5" />,
        badge:
          failingCheckCount > 0 ? (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-destructive/10 text-destructive border border-destructive/20">
              {failingCheckCount}
            </span>
          ) : undefined,
        requiresPR: true,
      },
      {
        value: "coverage",
        label: "Coverage",
        icon: <BarChart3 className="size-3.5" />,
        badge:
          hasCoverage && !coverageCheckPassed ? (
            <span className="size-2 rounded-full bg-destructive" />
          ) : undefined,
        requiresPR: true,
      },
      {
        value: "merge",
        label: "Merge",
        icon: <GitMerge className="size-3.5" />,
        badge: hasConflicts ? (
          <span className="size-2 rounded-full bg-destructive" />
        ) : undefined,
        requiresPR: true,
      },
    );
  }

  // If the active view requires PR but there's no PR, fall back to files-changed
  const effectiveView =
    activeView !== "files-changed" && !hasPR ? "files-changed" : activeView;

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const renderTabContent = () => {
    if (effectiveView === "files-changed") {
      return <GitDiffView thread={thread} />;
    }

    // PR-related tabs - show skeletons while loading
    if (effectiveView === "comments") {
      if (comments.isLoading) {
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <CommentsSkeleton />
          </div>
        );
      }
      if (comments.error) {
        return <TabErrorState message="Failed to load comments" />;
      }
      if (comments.data) {
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <PRCommentsSection
              unresolved={comments.data.comments.unresolved}
              resolved={comments.data.comments.resolved}
            />
          </div>
        );
      }
      return null;
    }

    if (effectiveView === "checks") {
      if (checks.isLoading) {
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <ChecksSkeleton />
          </div>
        );
      }
      if (checks.error) {
        return <TabErrorState message="Failed to load checks" />;
      }
      if (checks.data) {
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <ChecksSection checks={checks.data.checks} />
          </div>
        );
      }
      return null;
    }

    if (effectiveView === "coverage") {
      if (checks.isLoading) {
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <CoverageSkeleton />
          </div>
        );
      }
      if (checks.error) {
        return <TabErrorState message="Failed to load coverage" />;
      }
      if (checks.data) {
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <CoverageSection coverageCheck={checks.data.coverageCheck} />
          </div>
        );
      }
      return null;
    }

    if (effectiveView === "merge") {
      if (header.isLoading) {
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <MergeStatusSkeleton />
          </div>
        );
      }
      if (header.error || !headerData) {
        return <TabErrorState message="Failed to load merge status" />;
      }
      return (
        <div className="flex-1 overflow-y-auto p-4">
          <MergeStatusSection
            mergeableState={headerData.mergeableState}
            hasConflicts={headerData.hasConflicts}
            isMergeable={headerData.isMergeable}
            baseBranch={headerData.baseBranch}
            headBranch={headerData.headBranch}
            prUrl={headerData.prUrl}
            prNumber={headerData.prNumber}
            repoFullName={headerData.repoFullName}
            thread={thread}
          />
        </div>
      );
    }

    return <GitDiffView thread={thread} />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with PR info */}
      {hasPR && (
        <>
          {isLoading ? (
            <PRHeaderSkeleton />
          ) : headerData ? (
            <div className="border-b px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <GitMerge className="size-4 flex-shrink-0" />
                  <a
                    href={headerData.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline flex items-center gap-1 shrink-0"
                  >
                    #{headerData.prNumber}
                    <ExternalLink className="size-3" />
                  </a>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {feedback && (
                    <AddressFeedbackDialog
                      feedback={feedback}
                      thread={thread}
                    />
                  )}
                  <MergeButton
                    repoFullName={headerData.repoFullName}
                    prNumber={headerData.prNumber}
                    prTitle={headerData.prTitle}
                    isMergeable={headerData.isMergeable}
                    isAutoMergeEnabled={headerData.isAutoMergeEnabled}
                    threadId={thread.id}
                    onMerged={handleRefresh}
                    onAutoMergeChanged={handleRefresh}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {headerData.prTitle}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Tab navigation */}
      <div className="flex items-center gap-1.5 p-2 border-b border-border/50 bg-background/50 backdrop-blur-sm overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <ViewTab
            key={tab.value}
            active={effectiveView === tab.value}
            onClick={() => setActiveView(tab.value)}
            badge={tab.badge}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </ViewTab>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden animate-page-enter futuristic-scrollbar">
        {renderTabContent()}
      </div>
    </div>
  );
}

function TabErrorState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 gap-3">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="size-6 text-destructive" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
}
