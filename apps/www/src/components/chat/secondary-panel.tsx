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
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useServerActionQuery } from "@/queries/server-action-helpers";
import { getPRFeedback } from "@/server-actions/get-pr-feedback";
import { PRCommentsSection } from "./code-review/pr-comments-section";
import { ChecksSection } from "./code-review/checks-section";
import { CoverageSection } from "./code-review/coverage-section";
import { MergeStatusSection } from "./code-review/merge-status-section";
import { MergeButton } from "./code-review/merge-button";
import { AddressFeedbackDialog } from "./code-review/address-feedback-dialog";
import { createFeedbackSummary } from "@terragon/shared/github/pr-feedback";
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

  // Fetch PR feedback data when thread has a PR
  const { data, isLoading, error, dataUpdatedAt } = useServerActionQuery({
    queryKey: ["pr-feedback", thread?.id, refreshKey],
    queryFn: () => getPRFeedback({ threadId: thread!.id }),
    enabled: hasPR && !!thread,
    staleTime: 30000, // 30 seconds
    refetchInterval: (query): number => {
      const mergeableState = query.state.data?.feedback?.mergeableState;
      return getMergeablePollingInterval({
        mergeableState,
        now: Date.now(),
        state: mergeablePollingRef.current,
        defaultIntervalMs: 60000,
      });
    },
  });

  const feedback = data?.feedback;
  const summary = feedback ? createFeedbackSummary(feedback) : null;

  // Update polling state when data changes - only increment count on actual refetch
  React.useEffect(() => {
    if (dataUpdatedAt === lastDataUpdatedAtRef.current) {
      return;
    }
    lastDataUpdatedAtRef.current = dataUpdatedAt;
    mergeablePollingRef.current = nextMergeablePollingState({
      mergeableState: feedback?.mergeableState,
      now: Date.now(),
      state: mergeablePollingRef.current,
    });
  }, [feedback?.mergeableState, dataUpdatedAt]);

  if (!thread) {
    return null;
  }

  // Calculate badge counts
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

  const renderTabContent = () => {
    if (effectiveView === "files-changed") {
      return <GitDiffView thread={thread} />;
    }

    // PR-related tabs require loading state handling
    if (isLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 gradient-shift-bg">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <Loader2 className="size-8 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-sm text-muted-foreground">
            Loading PR feedback...
          </p>
        </div>
      );
    }

    if (error || !feedback) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 gap-3">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="size-6 text-destructive" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">
              Failed to load PR feedback
            </p>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </div>
      );
    }

    switch (effectiveView) {
      case "comments":
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <PRCommentsSection
              unresolved={feedback.comments.unresolved}
              resolved={feedback.comments.resolved}
            />
          </div>
        );
      case "checks":
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <ChecksSection checks={feedback.checks} />
          </div>
        );
      case "coverage":
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <CoverageSection coverageCheck={feedback.coverageCheck} />
          </div>
        );
      case "merge":
        return (
          <div className="flex-1 overflow-y-auto p-4">
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
          </div>
        );
      default:
        return <GitDiffView thread={thread} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with PR info */}
      {hasPR && feedback && (
        <div className="border-b px-4 py-3 space-y-2">
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
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <AddressFeedbackDialog feedback={feedback} thread={thread} />
              <MergeButton
                repoFullName={feedback.repoFullName}
                prNumber={feedback.prNumber}
                prTitle={feedback.prTitle}
                isMergeable={feedback.isMergeable}
                threadId={thread.id}
                onMerged={() => setRefreshKey((k) => k + 1)}
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {feedback.prTitle}
          </div>
        </div>
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
