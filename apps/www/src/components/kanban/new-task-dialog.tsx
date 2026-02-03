"use client";

import { memo, useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GenericPromptBox } from "@/components/promptbox/generic-promptbox";
import { RepoBranchSelector } from "@/components/repo-branch-selector";
import {
  useSelectedRepo,
  useSelectedBranch,
} from "@/hooks/useSelectedRepoAndBranch";
import {
  PromptBoxToolBelt,
  usePromptBoxToolBeltOptions,
} from "@/components/promptbox/prompt-box-tool-belt";
import { BacklogTemplatePicker } from "./backlog-templates";
import { BacklogTemplate } from "@/lib/backlog-templates";
import { newThread } from "@/server-actions/new-thread";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { threadQueryKeys } from "@/queries/thread-queries";
import { unwrapResult, unwrapError } from "@/lib/server-actions";
import type { DBUserMessage } from "@terragon/shared";
import {
  HandleSubmit,
  HandleUpdate,
} from "@/components/promptbox/use-promptbox";
import { SmartContextSection } from "@/components/environments/smart-context-section";

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyMessage: DBUserMessage = {
  type: "user",
  model: "sonnet",
  permissionMode: "plan", // Default to plan mode
  parts: [{ type: "text", text: "" }],
};

function NewTaskDialogInner({ open, onOpenChange }: NewTaskDialogProps) {
  const [repoFullName, setRepoFullName] = useSelectedRepo();
  const [branchName, setBranchName] = useSelectedBranch();
  const [message, setMessage] = useState<DBUserMessage>(emptyMessage);
  const [selectedTemplate, setSelectedTemplate] =
    useState<BacklogTemplate | null>(null);
  const queryClient = useQueryClient();

  const {
    skipSetup,
    disableGitCheckpointing,
    createNewBranch,
    setSkipSetup,
    setDisableGitCheckpointing,
    setCreateNewBranch,
  } = usePromptBoxToolBeltOptions({
    branchName,
    shouldUseCookieValues: true,
  });

  const handleRepoBranchChange = useCallback(
    (repo: string | null, branch: string | null) => {
      setRepoFullName(repo);
      setBranchName(branch);
    },
    [setRepoFullName, setBranchName],
  );

  const handleTemplateSelect = useCallback(
    (template: BacklogTemplate | null) => {
      setSelectedTemplate(template);
      if (template) {
        setMessage({
          ...emptyMessage,
          parts: [{ type: "text", text: template.prompt }],
        });
      }
    },
    [],
  );

  const handleUpdate = useCallback<HandleUpdate>(({ userMessage }) => {
    setMessage(userMessage);
    // Clear selected template when user edits the message
    // so template picker shows "No template" after user modifications
    setSelectedTemplate(null);
  }, []);

  const handleSubmit = useCallback<HandleSubmit>(
    async ({ userMessage, selectedModels, saveAsDraft, scheduleAt }) => {
      if (!repoFullName || !branchName) {
        toast.error("Please select a repository and branch");
        return;
      }

      try {
        unwrapResult(
          await newThread({
            message: userMessage,
            githubRepoFullName: repoFullName,
            branchName,
            saveAsDraft,
            scheduleAt,
            selectedModels,
            createNewBranch,
            disableGitCheckpointing,
            skipSetup,
          }),
        );

        if (saveAsDraft) {
          toast.success("Task saved as draft");
        } else {
          toast.success("Task started");
        }

        queryClient.refetchQueries({
          queryKey: threadQueryKeys.list({ archived: false }),
        });

        // Reset form
        setMessage(emptyMessage);
        setSelectedTemplate(null);
        onOpenChange(false);
      } catch (error) {
        console.error("Failed to create task:", error);
        toast.error(unwrapError(error));
        throw error;
      }
    },
    [
      repoFullName,
      branchName,
      createNewBranch,
      disableGitCheckpointing,
      skipSetup,
      queryClient,
      onOpenChange,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] flex flex-col max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>
            Create a new task. Save as draft for later or start immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto min-h-0 py-2">
          <div className="flex items-center gap-2">
            <BacklogTemplatePicker
              onTemplateSelect={handleTemplateSelect}
              selectedTemplateId={selectedTemplate?.id}
              className="w-[200px]"
            />
          </div>

          <GenericPromptBox
            className="min-h-[150px] max-h-[300px]"
            placeholder="Describe your task..."
            message={message}
            repoFullName={repoFullName ?? ""}
            branchName={branchName ?? ""}
            onSubmit={handleSubmit}
            onUpdate={handleUpdate}
            hideSubmitButton={false}
            autoFocus={true}
            forcedAgent={null}
            forcedAgentVersion={null}
            clearContentOnSubmit={false}
            supportSaveAsDraft={true}
            supportSchedule={true}
            supportMultiAgentPromptSubmission={true}
          />

          <div className="flex items-center justify-between">
            <RepoBranchSelector
              selectedRepoFullName={repoFullName || null}
              selectedBranch={branchName || null}
              onChange={handleRepoBranchChange}
            />

            <PromptBoxToolBelt
              showSkipSetup={true}
              skipSetupValue={skipSetup}
              onSkipSetupChange={setSkipSetup}
              skipSetupDisabled={!repoFullName}
              showCheckpoint={true}
              checkpointValue={disableGitCheckpointing}
              onCheckpointChange={setDisableGitCheckpointing}
              checkpointDisabled={!repoFullName}
              showCreateNewBranchOption={true}
              createNewBranchValue={createNewBranch}
              onCreateNewBranchChange={setCreateNewBranch}
              createNewBranchDisabled={!repoFullName}
            />
          </div>

          {/* Smart Context Section */}
          <div className="border-t pt-3 mt-1">
            <SmartContextSection repoFullName={repoFullName} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const NewTaskDialog = memo(NewTaskDialogInner);
