"use client";

import { memo, useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RepoBranchSelector } from "@/components/repo-branch-selector";
import {
  useSelectedRepo,
  useSelectedBranch,
} from "@/hooks/useSelectedRepoAndBranch";
import { BacklogTemplatePicker } from "./backlog-templates";
import { BacklogTemplate } from "@/lib/backlog-templates";
import { newThread } from "@/server-actions/new-thread";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { threadQueryKeys } from "@/queries/thread-queries";
import { unwrapResult, unwrapError } from "@/lib/server-actions";
import type { DBUserMessage } from "@terragon/shared";

interface QuickAddBacklogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function QuickAddBacklogDialogInner({
  open,
  onOpenChange,
}: QuickAddBacklogDialogProps) {
  const [repoFullName, setRepoFullName] = useSelectedRepo();
  const [branchName, setBranchName] = useSelectedBranch();
  const [taskDescription, setTaskDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<BacklogTemplate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

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
        setTaskDescription(template.prompt);
      }
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!taskDescription.trim() || !repoFullName || !branchName) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const userMessage: DBUserMessage = {
        type: "user",
        model: "sonnet",
        permissionMode: "plan", // Default to plan mode for backlog items
        parts: [{ type: "text", text: taskDescription.trim() }],
      };

      unwrapResult(
        await newThread({
          message: userMessage,
          githubRepoFullName: repoFullName,
          branchName,
          saveAsDraft: true, // Always save as draft for backlog
          createNewBranch: true,
        }),
      );

      toast.success("Added to backlog");
      queryClient.refetchQueries({
        queryKey: threadQueryKeys.list({ archived: false }),
      });

      // Reset form
      setTaskDescription("");
      setSelectedTemplate(null);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add to backlog:", error);
      toast.error(unwrapError(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [taskDescription, repoFullName, branchName, queryClient, onOpenChange]);

  const isSubmitDisabled =
    !taskDescription.trim() || !repoFullName || !branchName || isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add to Backlog</DialogTitle>
          <DialogDescription>
            Capture an idea or task for later. It will be saved as a draft in
            plan mode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <BacklogTemplatePicker
              onTemplateSelect={handleTemplateSelect}
              selectedTemplateId={selectedTemplate?.id}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="Describe your idea or task..."
              className="min-h-[150px] resize-none"
              value={taskDescription}
              onChange={(e) => {
                setTaskDescription(e.target.value);
                // Clear template selection when user manually edits
                if (selectedTemplate) {
                  setSelectedTemplate(null);
                }
              }}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <RepoBranchSelector
              selectedRepoFullName={repoFullName || null}
              selectedBranch={branchName || null}
              onChange={handleRepoBranchChange}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {isSubmitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add to Backlog"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const QuickAddBacklogDialog = memo(QuickAddBacklogDialogInner);
