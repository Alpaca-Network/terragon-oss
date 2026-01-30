"use client";

import {
  DashboardPromptBoxHandleSubmit,
  DashboardPromptBox,
} from "./promptbox/dashboard-promptbox";
import { ThreadListMain } from "./thread-list/main";
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
import { Button } from "@/components/ui/button";
import { SquarePen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function Dashboard({
  showArchived = false,
}: {
  showArchived?: boolean;
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

  // Determine if there are any active tasks; used for Sawyer UI empty state
  const { data } = useInfiniteThreadList({ archived: false });
  const showRecommendedTasks =
    (data?.pages.flatMap((page) => page) ?? []).length < 3;

  // Show Kanban view on larger screens when viewMode is 'kanban'
  const showKanbanView = viewMode === "kanban" && mounted;

  // State for the new task dialog in Kanban view
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);

  // Wrap handleSubmit to close dialog on successful submission
  const handleKanbanSubmit = useCallback<DashboardPromptBoxHandleSubmit>(
    async (params) => {
      await handleSubmit(params);
      if (!params.saveAsDraft) {
        setNewTaskDialogOpen(false);
      }
    },
    [handleSubmit],
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full",
        showKanbanView ? "max-w-full" : "max-w-2xl mx-auto gap-8 pt-2.5",
      )}
    >
      <FeatureUpsellToast />

      {/* Task View Toggle - shown at top right in both views on desktop */}
      {mounted && (
        <div
          className={cn(
            "hidden lg:flex justify-end items-center gap-2",
            showKanbanView ? "px-4 pt-3 pb-1" : "pb-0",
          )}
        >
          {/* New Task button for Kanban view */}
          {showKanbanView && (
            <Dialog
              open={newTaskDialogOpen}
              onOpenChange={setNewTaskDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <SquarePen className="h-4 w-4" />
                  <span>New Task</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Task</DialogTitle>
                </DialogHeader>
                <DashboardPromptBox
                  placeholder={placeholder}
                  status={null}
                  threadId={null}
                  onUpdate={onUpdate}
                  handleStop={handleStop}
                  handleSubmit={handleKanbanSubmit}
                  promptText={promptText ?? undefined}
                />
              </DialogContent>
            </Dialog>
          )}
          <TaskViewToggle />
        </div>
      )}

      {/* View toggle and prompt box - only show in list view or on mobile */}
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
          {showRecommendedTasks && (
            <div className="space-y-2 hidden lg:block">
              <h3 className="text-sm font-medium text-muted-foreground/70">
                Suggested tasks
              </h3>
              <RecommendedTasks
                onTaskSelect={(p) => setPromptText(p)}
                selectedModel={selectedModel}
              />
            </div>
          )}
        </>
      )}

      {/* Desktop: Show Kanban or List based on viewMode */}
      {mounted && (
        <div className="hidden lg:flex flex-1 min-h-0">
          {showKanbanView ? (
            <KanbanBoard
              queryFilters={{ archived: showArchived }}
              initialSelectedTaskId={initialTaskId}
            />
          ) : (
            <div className="w-full">
              <ThreadListMain
                queryFilters={{ archived: showArchived }}
                viewFilter={showArchived ? "archived" : "active"}
                allowGroupBy={true}
                showSuggestedTasks={false}
                setPromptText={setPromptText}
              />
            </div>
          )}
        </div>
      )}

      {/* Mobile: Always show list view */}
      {mounted && (
        <div className="lg:hidden">
          <ThreadListMain
            queryFilters={{ archived: showArchived }}
            viewFilter={showArchived ? "archived" : "active"}
            allowGroupBy={true}
            showSuggestedTasks={showRecommendedTasks}
            setPromptText={setPromptText}
          />
        </div>
      )}
    </div>
  );
}
