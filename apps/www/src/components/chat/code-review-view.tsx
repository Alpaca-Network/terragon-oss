"use client";

import React, { useState } from "react";
import type { ThreadInfoFull } from "@terragon/shared/db/types";
import {
  MessageSquare,
  CheckCircle2,
  BarChart3,
  GitMerge,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface CodeReviewViewProps {
  thread: ThreadInfoFull;
}

type TabValue = "comments" | "checks" | "coverage" | "conflicts";

export function CodeReviewView({ thread }: CodeReviewViewProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("comments");
  const [refreshKey, setRefreshKey] = useState(0);

  const { header, comments, checks, summary, isLoading, hasError } =
    usePRFeedback(thread.id, {
      enabled: !!thread.githubPRNumber,
      refreshKey,
      staleTime: 30000,
      refetchInterval: 60000,
    });

  // No PR associated
  if (!thread.githubPRNumber) {
    return (
      <div className="flex flex-col h-full">
        <CodeReviewHeaderPlaceholder />
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
          <GitMerge className="size-12 mb-4 opacity-30" />
          <p className="text-sm text-center">
            No pull request associated with this task
          </p>
          <p className="text-xs text-center mt-1 text-muted-foreground/70">
            Create a PR to see code review feedback here
          </p>
        </div>
      </div>
    );
  }

  // Header loading - show skeleton for header area
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PRHeaderSkeleton />
        <div className="flex-1 overflow-y-auto p-4">
          <CommentsSkeleton />
        </div>
      </div>
    );
  }

  // Header error
  if (hasError && !header.data) {
    return (
      <div className="flex flex-col h-full">
        <CodeReviewHeaderPlaceholder />
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
          <AlertCircle className="size-8 mb-2 text-destructive" />
          <p className="text-sm text-center">Failed to load PR feedback</p>
          <p className="text-xs text-center mt-1">
            {header.error instanceof Error
              ? header.error.message
              : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  const headerData = header.data;
  if (!headerData) {
    return null;
  }

  // Combine data for AddressFeedbackDialog (needs full feedback object)
  const feedback = combinePRFeedbackFromQueries(
    headerData,
    comments.data,
    checks.data,
  );

  // Calculate badge counts from summary (computed in hook)
  const commentCount = summary?.unresolvedCommentCount ?? 0;
  const failingCheckCount = summary?.failingCheckCount ?? 0;
  const hasCoverage = summary?.hasCoverageCheck ?? false;
  const coverageCheckPassed = summary?.coverageCheckPassed ?? true;
  const hasConflicts = summary?.hasConflicts ?? false;

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3 space-y-3">
        {/* Mobile: single row with PR link, Address Feedback, and Merge button */}
        <div className="flex sm:hidden items-center justify-between gap-2">
          <a
            href={headerData.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
          >
            PR #{headerData.prNumber}
            <ExternalLink className="size-3" />
          </a>
          <div className="flex items-center gap-2">
            {feedback && (
              <AddressFeedbackDialog feedback={feedback} thread={thread} />
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

        {/* Desktop: original two-row layout */}
        <div className="hidden sm:flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <GitMerge className="size-4 flex-shrink-0" />
            <h2 className="text-sm font-medium truncate">Code Review</h2>
            <a
              href={headerData.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
            >
              #{headerData.prNumber}
              <ExternalLink className="size-3" />
            </a>
          </div>
          {feedback && (
            <AddressFeedbackDialog feedback={feedback} thread={thread} />
          )}
        </div>

        {/* Desktop: Merge button row */}
        <div className="hidden sm:flex items-center justify-between gap-2 overflow-hidden">
          <div className="text-xs text-muted-foreground truncate min-w-0 flex-1">
            {headerData.prTitle}
          </div>
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

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger
            value="comments"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 px-3"
          >
            <MessageSquare className="size-4 mr-1.5" />
            Comments
            {commentCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                {commentCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="checks"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 px-3"
          >
            <CheckCircle2 className="size-4 mr-1.5" />
            Checks
            {failingCheckCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                {failingCheckCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="coverage"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 px-3"
          >
            <BarChart3 className="size-4 mr-1.5" />
            Coverage
            {hasCoverage && !coverageCheckPassed && (
              <span className="ml-1.5 size-2 rounded-full bg-red-500" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="conflicts"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 px-3"
          >
            <GitMerge className="size-4 mr-1.5" />
            Merge
            {hasConflicts && (
              <span className="ml-1.5 size-2 rounded-full bg-red-500" />
            )}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="comments" className="mt-0 h-full">
            {comments.isLoading ? (
              <CommentsSkeleton />
            ) : comments.error ? (
              <TabErrorState message="Failed to load comments" />
            ) : comments.data ? (
              <PRCommentsSection
                unresolved={comments.data.comments.unresolved}
                resolved={comments.data.comments.resolved}
              />
            ) : null}
          </TabsContent>
          <TabsContent value="checks" className="mt-0 h-full">
            {checks.isLoading ? (
              <ChecksSkeleton />
            ) : checks.error ? (
              <TabErrorState message="Failed to load checks" />
            ) : checks.data ? (
              <ChecksSection checks={checks.data.checks} />
            ) : null}
          </TabsContent>
          <TabsContent value="coverage" className="mt-0 h-full">
            {checks.isLoading ? (
              <CoverageSkeleton />
            ) : checks.error ? (
              <TabErrorState message="Failed to load coverage" />
            ) : checks.data ? (
              <CoverageSection coverageCheck={checks.data.coverageCheck} />
            ) : null}
          </TabsContent>
          <TabsContent value="conflicts" className="mt-0 h-full">
            {header.isLoading ? (
              <MergeStatusSkeleton />
            ) : (
              <MergeStatusSection
                mergeableState={headerData.mergeableState}
                hasConflicts={headerData.hasConflicts}
                isMergeable={headerData.isMergeable}
                baseBranch={headerData.baseBranch}
                headBranch={headerData.headBranch}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function CodeReviewHeaderPlaceholder() {
  return (
    <div className="border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <GitMerge className="size-4" />
        <h2 className="text-sm font-medium">Code Review</h2>
      </div>
    </div>
  );
}

function TabErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <AlertCircle className="size-8 mb-2 text-destructive opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
