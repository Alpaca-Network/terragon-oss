"use client";

import { memo, useCallback, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { DashboardPromptBox } from "../promptbox/dashboard-promptbox";
import { newThread } from "@/server-actions/new-thread";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { threadQueryKeys, ThreadListFilters } from "@/queries/thread-queries";
import { unwrapError, unwrapResult } from "@/lib/server-actions";
import { DashboardPromptBoxHandleSubmit } from "../promptbox/dashboard-promptbox";
import { HandleUpdate } from "../promptbox/use-promptbox";
import { convertToPlainText } from "@/lib/db-message-helpers";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useSelectedRepo } from "@/hooks/useSelectedRepoAndBranch";
import { NewProjectView } from "../onboarding/new-project-view";

type ViewMode = "task" | "new-project";

export const KanbanNewTaskDrawer = memo(function KanbanNewTaskDrawer({
  open,
  onClose,
  queryFilters,
}: {
  open: boolean;
  onClose: () => void;
  queryFilters: ThreadListFilters;
}) {
  const queryClient = useQueryClient();
  const [placeholder, setPlaceholder] = useState(
    "Type your message here... Use @ to mention files (Enter to send)",
  );
  const [selectedRepo] = useSelectedRepo();
  const [viewMode, setViewMode] = useState<ViewMode>("task");

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
      autoFixFeedback,
      autoMergePR,
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
            autoFixFeedback,
            autoMergePR,
          }),
        );
        queryClient.refetchQueries({
          queryKey: threadQueryKeys.list(queryFilters),
        });
        if (saveAsDraft) {
          toast.success("Task saved as draft successfully.");
        } else {
          toast.success("Task created successfully.");
        }
        onClose();
      } catch (error: unknown) {
        console.error("Failed to create thread:", error);
        toast.error(unwrapError(error), { duration: 5000 });
        throw error;
      }
    },
    [queryClient, onClose, queryFilters],
  );

  const handleStop = useCallback(async () => {
    throw new Error("Cannot stop thread in new task drawer.");
  }, []);

  const onUpdate = useCallback<HandleUpdate>(({ userMessage }) => {
    const plainText = convertToPlainText({
      message: userMessage,
      skipAttachments: true,
    });
    setPlaceholder(
      plainText.length === 0
        ? "Type your message here... Use @ to mention files (Enter to send)"
        : "",
    );
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      // Reset view mode when closing
      setViewMode("task");
    }
  };

  const handleNewProjectCreated = () => {
    onClose();
    setViewMode("task");
    queryClient.refetchQueries({
      queryKey: threadQueryKeys.list(queryFilters),
    });
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[85vh] max-h-[85vh]">
        {viewMode === "new-project" ? (
          <>
            <VisuallyHidden>
              <DrawerHeader>
                <DrawerTitle>New Project</DrawerTitle>
              </DrawerHeader>
            </VisuallyHidden>
            <NewProjectView
              onBack={() => setViewMode("task")}
              onRepoCreated={handleNewProjectCreated}
              className="h-full"
            />
          </>
        ) : (
          <>
            <DrawerHeader className="flex flex-row items-center justify-between border-b py-2 px-3 flex-shrink-0">
              <VisuallyHidden>
                <DrawerTitle>New Task</DrawerTitle>
              </VisuallyHidden>
              <span className="text-sm font-medium">New Task</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
                aria-label="Close new task drawer"
              >
                <X className="h-4 w-4" />
              </Button>
            </DrawerHeader>

            <div className="flex-1 overflow-auto p-4">
              <DashboardPromptBox
                placeholder={placeholder}
                status={null}
                threadId={null}
                onUpdate={onUpdate}
                handleStop={handleStop}
                handleSubmit={handleSubmit}
              />

              {/* New Project button when no repo is selected */}
              {!selectedRepo && (
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => setViewMode("new-project")}
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Project</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      Create a new repository
                    </span>
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
});
