"use client";

import {
  DashboardPromptBoxHandleSubmit,
  DashboardPromptBox,
} from "./promptbox/dashboard-promptbox";
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
import { useAtom, useAtomValue } from "jotai";
import { selectedModelAtom } from "@/atoms/user-flags";
import { dashboardViewModeAtom } from "@/atoms/user-cookies";
import { FeatureUpsellToast } from "@/components/feature-upsell-toast";
import { unwrapError, unwrapResult } from "@/lib/server-actions";
import { KanbanBoard } from "./kanban";
import { TaskViewToggle } from "./task-view-toggle";
import { RecentReposQuickAccess } from "./onboarding/recent-repos-quick-access";
import { TemplateRepoSelector } from "./onboarding/template-repo-selector";
import { KanbanPromotionBanner } from "./onboarding/kanban-promotion-banner";
import { NewProjectView } from "./onboarding/new-project-view";
import { getUserRepos } from "@/server-actions/user-repos";
import { useServerActionQuery } from "@/queries/server-action-helpers";
import { usePlatform } from "@/hooks/use-platform";

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
  const [viewMode, setViewMode] = useAtom(dashboardViewModeAtom);
  const platform = usePlatform();
  const searchParams = useSearchParams();
  const initialTaskId = searchParams.get("task");

  // Set default view to 'new-project' on mobile for first-time users
  useEffect(() => {
    setMounted(true);
  }, []);

  // On mobile, default to 'new-project' view if user hasn't explicitly chosen a view
  useEffect(() => {
    if (platform === "mobile" && viewMode === "list") {
      setViewMode("new-project");
    }
  }, [platform, viewMode, setViewMode]);

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
  const { data, isLoading: isLoadingThreads } = useInfiniteThreadList({
    archived: false,
  });
  const activeTaskCount = (data?.pages.flatMap((page) => page) ?? []).length;

  // Fetch user repos for onboarding
  const { data: reposResult, isLoading: isLoadingRepos } = useServerActionQuery(
    {
      queryKey: ["user-repos"],
      queryFn: getUserRepos,
    },
  );
  const userRepos = reposResult?.repos ?? [];
  const repoCount = userRepos.length;

  // Determine user state for onboarding - only calculate once data is loaded
  const isDataLoaded = !isLoadingThreads && !isLoadingRepos;
  const isNewUser = isDataLoaded && activeTaskCount === 0;
  const isGrowingUser =
    isDataLoaded && activeTaskCount > 0 && activeTaskCount < 3;
  // Should show template selector only after data is loaded to prevent flash
  const shouldShowTemplateSelector =
    isDataLoaded && (isNewUser || repoCount < 3);

  // Show Kanban view when viewMode is 'kanban' (works on both desktop and mobile)
  const showKanbanView = viewMode === "kanban" && mounted;
  // Show New Project view when viewMode is 'new-project'
  const showNewProjectView = viewMode === "new-project" && mounted;
  // Show Inbox (list) view for the remaining case
  const showInboxView = viewMode === "list" && mounted;

  // Determine query filters for Kanban view
  const queryFilters = showArchived
    ? { archived: true }
    : showBacklog
      ? { isBacklog: true }
      : { archived: false, isBacklog: false };

  // Handler to switch back from new-project view after creating a repo
  const handleBackFromNewProject = useCallback(() => {
    setViewMode("list");
  }, [setViewMode]);

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full",
        showKanbanView || showNewProjectView
          ? "max-w-full"
          : "max-w-2xl mx-auto gap-8 pt-2.5",
      )}
    >
      <FeatureUpsellToast />

      {/* Task View Toggle - shown at top in inbox view and new-project view */}
      {mounted && !showKanbanView && (
        <div
          className={cn(
            "flex justify-end items-center gap-2 pb-0",
            showNewProjectView && "px-4 pt-2",
          )}
        >
          <TaskViewToggle />
        </div>
      )}

      {/* New Project view - full-page template selection */}
      {showNewProjectView && (
        <div className="flex-1 overflow-auto">
          <NewProjectView
            onBack={handleBackFromNewProject}
            onRepoCreated={handleBackFromNewProject}
            className="h-full"
          />
        </div>
      )}

      {/* Inbox view - prompt box and onboarding content */}
      {showInboxView && (
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
            {shouldShowTemplateSelector && <TemplateRepoSelector />}

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

      {/* Kanban view - single component handles responsive layout internally */}
      {showKanbanView && (
        <div className="flex flex-col flex-1 min-h-0">
          <KanbanBoard
            queryFilters={queryFilters}
            initialSelectedTaskId={initialTaskId}
          />
        </div>
      )}
    </div>
  );
}
