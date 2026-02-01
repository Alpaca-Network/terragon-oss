"use client";

import React, { useState } from "react";
import type { ThreadInfoFull } from "@terragon/shared/db/types";
import { useServerActionQuery } from "@/queries/server-action-helpers";
import {
  MessageSquare,
  CheckCircle2,
  BarChart3,
  GitMerge,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPRFeedback } from "@/server-actions/get-pr-feedback";
import { PRCommentsSection } from "./code-review/pr-comments-section";
import { ChecksSection } from "./code-review/checks-section";
import { CoverageSection } from "./code-review/coverage-section";
import { MergeStatusSection } from "./code-review/merge-status-section";
import { MergeButton } from "./code-review/merge-button";
import { AddressFeedbackDialog } from "./code-review/address-feedback-dialog";
import { createFeedbackSummary } from "@terragon/shared/github/pr-feedback";

interface CodeReviewViewProps {
  thread: ThreadInfoFull;
}

type TabValue = "comments" | "checks" | "coverage" | "conflicts";

export function CodeReviewView({ thread }: CodeReviewViewProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("comments");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error } = useServerActionQuery({
    queryKey: ["pr-feedback", thread.id, refreshKey],
    queryFn: () => getPRFeedback({ threadId: thread.id }),
    enabled: !!thread.githubPRNumber,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  if (!thread.githubPRNumber) {
    return (
      <div className="flex flex-col h-full">
        <CodeReviewHeader thread={thread} />
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

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <CodeReviewHeader thread={thread} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full">
        <CodeReviewHeader thread={thread} />
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
          <AlertCircle className="size-8 mb-2 text-destructive" />
          <p className="text-sm text-center">Failed to load PR feedback</p>
          <p className="text-xs text-center mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  const { feedback } = data;
  const summary = createFeedbackSummary(feedback);

  // Calculate badge counts
  const commentCount = summary.unresolvedCommentCount;
  const failingCheckCount = summary.failingCheckCount;
  const hasCoverage = summary.hasCoverageCheck;
  const hasConflicts = summary.hasConflicts;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <GitMerge className="size-4 flex-shrink-0" />
            <h2 className="text-sm font-medium truncate">Code Review</h2>
            <a
              href={feedback.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
            >
              #{feedback.prNumber}
              <ExternalLink className="size-3" />
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AddressFeedbackDialog feedback={feedback} thread={thread} />
          </div>
        </div>

        {/* Merge button row */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground truncate min-w-0 flex-1">
            {feedback.prTitle}
          </div>
          <div className="shrink-0">
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
            {hasCoverage && !summary.coverageCheckPassed && (
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
            <PRCommentsSection
              unresolved={feedback.comments.unresolved}
              resolved={feedback.comments.resolved}
            />
          </TabsContent>
          <TabsContent value="checks" className="mt-0 h-full">
            <ChecksSection checks={feedback.checks} />
          </TabsContent>
          <TabsContent value="coverage" className="mt-0 h-full">
            <CoverageSection coverageCheck={feedback.coverageCheck} />
          </TabsContent>
          <TabsContent value="conflicts" className="mt-0 h-full">
            <MergeStatusSection
              mergeableState={feedback.mergeableState}
              hasConflicts={feedback.hasConflicts}
              isMergeable={feedback.isMergeable}
              baseBranch={feedback.baseBranch}
              headBranch={feedback.headBranch}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function CodeReviewHeader({ thread }: { thread: ThreadInfoFull }) {
  return (
    <div className="border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <GitMerge className="size-4" />
        <h2 className="text-sm font-medium">Code Review</h2>
      </div>
    </div>
  );
}
