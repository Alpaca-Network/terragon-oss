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
        <DrawerContent className="h-[80vh]">
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
        "flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
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

  const hasPR =
    thread?.githubPRNumber !== null && thread?.githubPRNumber !== undefined;

  // Fetch PR feedback data when thread has a PR
  const { data, isLoading, error } = useServerActionQuery({
    queryKey: ["pr-feedback", thread?.id, refreshKey],
    queryFn: () => getPRFeedback({ threadId: thread!.id }),
    enabled: hasPR && !!thread,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  if (!thread) {
    return null;
  }

  const feedback = data?.feedback;
  const summary = feedback ? createFeedbackSummary(feedback) : null;

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
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
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
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
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
            <span className="size-2 rounded-full bg-red-500" />
          ) : undefined,
        requiresPR: true,
      },
      {
        value: "merge",
        label: "Merge",
        icon: <GitMerge className="size-3.5" />,
        badge: hasConflicts ? (
          <span className="size-2 rounded-full bg-red-500" />
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
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error || !feedback) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
          <AlertCircle className="size-8 mb-2 text-destructive" />
          <p className="text-sm text-center">Failed to load PR feedback</p>
          <p className="text-xs text-center mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
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
            />
          </div>
        );
      default:
        return <GitDiffView thread={thread} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with PR info when on PR tabs */}
      {hasPR && feedback && effectiveView !== "files-changed" && (
        <div className="border-b px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <GitMerge className="size-4 flex-shrink-0" />
              <a
                href={feedback.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:underline flex items-center gap-1"
              >
                #{feedback.prNumber}
                <ExternalLink className="size-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <AddressFeedbackDialog feedback={feedback} />
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
      <div className="flex items-center gap-1 p-2 border-b bg-muted/30 overflow-x-auto">
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
      <div className="flex-1 overflow-hidden">{renderTabContent()}</div>
    </div>
  );
}
