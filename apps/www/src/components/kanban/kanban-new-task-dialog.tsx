"use client";

import { memo, useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashboardPromptBox } from "../promptbox/dashboard-promptbox";
import { newThread } from "@/server-actions/new-thread";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { threadQueryKeys, ThreadListFilters } from "@/queries/thread-queries";
import { unwrapError, unwrapResult } from "@/lib/server-actions";
import { DashboardPromptBoxHandleSubmit } from "../promptbox/dashboard-promptbox";
import { HandleUpdate } from "../promptbox/use-promptbox";
import { convertToPlainText } from "@/lib/db-message-helpers";

export const KanbanNewTaskDialog = memo(function KanbanNewTaskDialog({
  open,
  onOpenChange,
  queryFilters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queryFilters: ThreadListFilters;
}) {
  const queryClient = useQueryClient();
  const [placeholder, setPlaceholder] = useState(
    "Type your message here... Use @ to mention files (Enter to send)",
  );

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
        queryClient.refetchQueries({
          queryKey: threadQueryKeys.list(queryFilters),
        });
        if (saveAsDraft) {
          toast.success("Task saved as draft successfully.");
        } else {
          toast.success("Task created successfully.");
        }
        onOpenChange(false);
      } catch (error: unknown) {
        console.error("Failed to create thread:", error);
        toast.error(unwrapError(error), { duration: 5000 });
        throw error;
      }
    },
    [queryClient, onOpenChange, queryFilters],
  );

  const handleStop = useCallback(async () => {
    throw new Error("Cannot stop thread in new task dialog.");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0">
          <DashboardPromptBox
            placeholder={placeholder}
            status={null}
            threadId={null}
            onUpdate={onUpdate}
            handleStop={handleStop}
            handleSubmit={handleSubmit}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
});
