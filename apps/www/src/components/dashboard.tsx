"use client";

import {
  DashboardPromptBoxHandleSubmit,
  DashboardPromptBox,
} from "./promptbox/dashboard-promptbox";
import { ThreadListMain, ThreadViewFilter } from "./thread-list/main";
import { newThread } from "@/server-actions/new-thread";
import { useTypewriterEffect } from "@/hooks/useTypewriter";
import { useCallback, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  threadQueryKeys,
  useInfiniteThreadList,
} from "@/queries/thread-queries";
import { convertToPlainText } from "@/lib/db-message-helpers";
import { HandleUpdate } from "./promptbox/use-promptbox";
import { cn } from "@/lib/utils";
import { RecommendedTasks } from "./recommended-tasks";
import { useAtomValue } from "jotai";
import { selectedModelAtom } from "@/atoms/user-flags";
import { dashboardViewModeAtom } from "@/atoms/user-cookies";
import { FeatureUpsellToast } from "@/components/feature-upsell-toast";
import { unwrapError, unwrapResult } from "@/lib/server-actions";
import { KanbanBoard } from "./kanban";
import { TaskViewToggle } from "./task-view-toggle";
import { RecentReposQuickAccess } from "./onboarding/recent-repos-quick-access";
import { TemplateRepoSelector } from "./onboarding/template-repo-selector";
import { KanbanPromotionBanner } from "./onboarding/kanban-promotion-banner";
import { getUserRepos } from "@/server-actions/user-repos";
import { useServerActionQuery } from "@/queries/server-action-helpers";

export function Dashboard({
  showArchived = false,
  showBacklog = false,
}: {
  showArchived?: boolean;
  showBacklog?: boolean;
}) {
  const [typewriterEffectEnabled, setTypewriterEffectEnabled] = useState(true);
  const placeholder = useTypewriterEffect(typewriterEffectEnabled);
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const viewMode = useAtomValue(dashboardViewModeAtom);
  const searchParams = useSearchParams();
  const initialTaskId = searchParams.get("task");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = useCallback<DashboardPromptBoxHandleSubmit>(
    async ({
      userMessage,
      repoFullName,
      selectedModels,
      branchName,
      saveAsDraft,
      scheduleAt,
      disableGitCheckpointing,
      skipSetup,
      createNewBranch,
    }) => {
      try {
        unwrapResult(
          await newThread({
            message: userMessage,
            githubRepoFullName: repoFullName,
            branchName,
            saveAsDraft,
            disableGitCheckpointing,
            skipSetup,
            createNewBranch,
            scheduleAt,
            selectedModels,
          }),
        );
        if (!saveAsDraft) {
          queryClient.refetchQueries({
            queryKey: threadQueryKeys.list({ archived: showArchived }),
          });
        } else {
          // For drafts, stay on dashboard and update the list
          toast.success("Task saved as draft successfully.");
          queryClient.refetchQueries({
            queryKey: threadQueryKeys.list({ archived: showArchived }),
          });
        }
      } catch (error: any) {
        console.error("Failed to create thread:", error);
        toast.error(unwrapError(error), { duration: 5000 });
        throw error; // Re-throw to trigger onSubmitError in usePromptBox
      }
    },
    [queryClient, showArchived],
  );

  const handleStop = useCallback(async () => {
    throw new Error("Cannot stop thread in dashboard.");
  }, []);

  const onUpdate = useCallback<HandleUpdate>(({ userMessage }) => {
    const plainText = convertToPlainText({
      message: userMessage,
      skipAttachments: true,
    });
    setTypewriterEffectEnabled(plainText.length === 0);
  }, []);

  const [promptText, setPromptText] = useState<string | null>(null);
  const selectedModel = useAtomValue(selectedModelAtom);

  // Determine if there are any active tasks; used for onboarding state
  const { data } = useInfiniteThreadList({ archived: false });
  const activeTaskCount = (data?.pages.flatMap((page) => page) ?? []).length;

  // Fetch user repos for onboarding
  const { data: reposResult } = useServerActionQuery({
    queryKey: ["user-repos"],
    queryFn: getUserRepos,
  });
  const userRepos = reposResult?.repos ?? [];
  const repoCount = userRepos.length;

  // Determine user state for onboarding
  const isNewUser = activeTaskCount === 0;
  const isGrowingUser = activeTaskCount > 0 && activeTaskCount < 3;

  // Show Kanban view when viewMode is 'kanban' (works on both desktop and mobile)
  const showKanbanView = viewMode === "kanban" && mounted;

  // Determine view filter and query filters
  const viewFilter: ThreadViewFilter = showArchived
    ? "archived"
    : showBacklog
      ? "backlog"
      : "active";
  const queryFilters = showArchived
    ? { archived: true }
    : showBacklog
      ? { isBacklog: true }
      : { archived: false, isBacklog: false };

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full",
        showKanbanView ? "max-w-full" : "max-w-2xl mx-auto gap-8 pt-2.5",
      )}
    >
      <FeatureUpsellToast />

      {/* Task View Toggle - shown at top right in inbox view on desktop (kanban has its own toggle) */}
      {mounted && !showKanbanView && (
        <div className="hidden lg:flex justify-end items-center gap-2 pb-0">
          <TaskViewToggle />
        </div>
      )}

      {/* View toggle and prompt box - only show in inbox view or on mobile */}
      {!showKanbanView && (
        <>
          <DashboardPromptBox
            placeholder={placeholder}
            status={null}
            threadId={null}
            onUpdate={onUpdate}
            handleStop={handleStop}
            handleSubmit={handleSubmit}
            promptText={promptText ?? undefined}
          />

          {/* Onboarding content - conditional based on user state */}
          <div className="space-y-4">
            {/* Recent Repos - for growing users with repos */}
            {isGrowingUser && repoCount >= 1 && (
              <RecentReposQuickAccess
                repos={userRepos.slice(0, 5)}
                onTaskSelect={(p) => setPromptText(p)}
              />
            )}

            {/* Template Selector - for new users or users with few repos */}
            {(isNewUser || repoCount < 3) && <TemplateRepoSelector />}

            {/* Kanban Promotion - for engaged but not power users */}
            {isGrowingUser && <KanbanPromotionBanner />}

            {/* Task Ideas - always show for growing users */}
            {isGrowingUser && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground/70">
                  Task Ideas
                </h3>
                <RecommendedTasks
                  onTaskSelect={(p) => setPromptText(p)}
                  selectedModel={selectedModel}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Desktop: Show Kanban or Inbox based on viewMode */}
      {mounted && (
        <div className="hidden lg:flex flex-1 min-h-0">
          {showKanbanView ? (
            <KanbanBoard
              queryFilters={queryFilters}
              initialSelectedTaskId={initialTaskId}
            />
          ) : (
            <div className="w-full">
              <ThreadListMain
                queryFilters={queryFilters}
                viewFilter={viewFilter}
                allowGroupBy={true}
                showSuggestedTasks={false} // Onboarding is now in dashboard.tsx
                setPromptText={setPromptText}
                showViewToggle={true}
              />
            </div>
          )}
        </div>
      )}

      {/* Mobile: Show Kanban or Inbox based on viewMode */}
      {mounted && (
        <div className="lg:hidden flex flex-col flex-1 min-h-0">
          {showKanbanView ? (
            <KanbanBoard
              queryFilters={queryFilters}
              initialSelectedTaskId={initialTaskId}
            />
          ) : (
            <ThreadListMain
              queryFilters={queryFilters}
              viewFilter={viewFilter}
              allowGroupBy={true}
              showSuggestedTasks={false} // Onboarding is now in dashboard.tsx
              setPromptText={setPromptText}
              showViewToggle={true}
            />
          )}
        </div>
      )}
    </div>
  );
}
