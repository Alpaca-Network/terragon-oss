"use client";

import React, { useState, useMemo } from "react";
import {
  Rocket,
  MessageSquarePlus,
  Edit3,
  GitMerge,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useServerActionMutation } from "@/queries/server-action-helpers";
import { newThread } from "@/server-actions/new-thread";
import { queueFollowUp, QueueFollowUpArgs } from "@/server-actions/follow-up";
import { getPrimaryThreadChat } from "@terragon/shared/utils/thread-utils";
import { useAtomValue } from "jotai";
import { selectedModelAtom } from "@/atoms/user-flags";
import { useAccessInfo } from "@/queries/subscription";
import { SUBSCRIPTION_MESSAGES } from "@/lib/subscription-msgs";
import { ModelSelector } from "@/components/model-selector";
import type { AIModel } from "@terragon/agent/types";
import type { PRFeedback } from "@terragon/shared/db/types";
import type { ThreadInfoFull } from "@terragon/shared";
import { generateFeedbackTaskDescription } from "@/lib/feedback-task-template";

type ActionMode = "new-task" | "integrate";

export function resolveFeedbackTaskModel({
  mode,
  defaultModel,
  taskModel,
}: {
  mode: ActionMode;
  defaultModel: AIModel;
  taskModel: AIModel;
}): AIModel {
  return mode === "new-task" ? taskModel : defaultModel;
}

interface AddressFeedbackDialogProps {
  feedback: PRFeedback;
  thread: ThreadInfoFull;
  trigger?: React.ReactNode;
}

export function AddressFeedbackDialog({
  feedback,
  thread,
  trigger,
}: AddressFeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ActionMode>("integrate");
  const [includeMergeInstructions, setIncludeMergeInstructions] =
    useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [autoMergePR, setAutoMergePR] = useState(thread.autoMergePR);
  const [autoFixFeedback, setAutoFixFeedback] = useState(
    thread.autoFixFeedback,
  );
  const { isActive } = useAccessInfo();
  const defaultModel = useAtomValue(selectedModelAtom);
  const [taskModel, setTaskModel] = useState<AIModel>(defaultModel);

  // Calculate whether automerge can be enabled
  // Criteria: all checks have succeeded and there are no unresolved comments
  const allChecksPassed = feedback.checks.every(
    (c) =>
      c.conclusion === "success" ||
      c.conclusion === "neutral" ||
      c.conclusion === "skipped",
  );
  const hasNoUnresolvedComments = feedback.comments.unresolved.length === 0;
  const canEnableAutoMerge =
    allChecksPassed && hasNoUnresolvedComments && !feedback.hasConflicts;

  // Generate the task description
  const generatedDescription = useMemo(
    () =>
      generateFeedbackTaskDescription(feedback, {
        includeMergeInstructions,
      }),
    [feedback, includeMergeInstructions],
  );

  const [editedDescription, setEditedDescription] =
    useState(generatedDescription);

  // Reset edited description when generated changes
  React.useEffect(() => {
    if (!isEditing) {
      setEditedDescription(generatedDescription);
    }
  }, [generatedDescription, isEditing]);

  React.useEffect(() => {
    if (open) {
      setTaskModel(defaultModel);
    }
  }, [open, defaultModel]);

  const createNewThreadMutation = useServerActionMutation({
    mutationFn: newThread,
    onSuccess: () => {
      toast.success("New task created to address PR feedback");
      setOpen(false);
    },
  });

  const addToQueueMutation = useServerActionMutation<QueueFollowUpArgs, void>({
    mutationFn: queueFollowUp,
    onSuccess: () => {
      toast.success("Feedback added to current task queue");
      setOpen(false);
    },
  });

  const handleSubmit = async () => {
    if (!isActive) {
      toast.error(SUBSCRIPTION_MESSAGES.CREATE_TASK);
      return;
    }

    const taskDescription = isEditing
      ? editedDescription
      : generatedDescription;
    const taskTitle = `Address PR feedback for #${feedback.prNumber}`;
    const messageModel = resolveFeedbackTaskModel({
      mode,
      defaultModel,
      taskModel,
    });

    if (mode === "new-task") {
      await createNewThreadMutation.mutateAsync({
        githubRepoFullName: feedback.repoFullName,
        branchName: feedback.headBranch,
        sourceType: "www-address-pr-feedback",
        parentThreadId: thread.id,
        autoMergePR,
        autoFixFeedback,
        message: {
          type: "user",
          model: messageModel,
          timestamp: new Date().toISOString(),
          parts: [
            {
              type: "text",
              text: `${taskTitle}\n\n${taskDescription}`,
            },
          ],
        },
      });
    } else {
      // Integrate into existing task by adding to queued messages
      const threadChat = getPrimaryThreadChat(thread);
      await addToQueueMutation.mutateAsync({
        threadId: thread.id,
        threadChatId: threadChat.id,
        autoMergePR,
        autoFixFeedback,
        messages: [
          {
            type: "user",
            model: messageModel,
            timestamp: new Date().toISOString(),
            parts: [
              {
                type: "text",
                text: taskDescription,
              },
            ],
          },
        ],
      });
    }
  };

  const isPending =
    createNewThreadMutation.isPending || addToQueueMutation.isPending;

  // Count issues to address
  const issueCount =
    feedback.comments.unresolved.length +
    feedback.checks.filter(
      (c) => c.conclusion === "failure" || c.conclusion === "timed_out",
    ).length +
    (feedback.hasConflicts ? 1 : 0);

  // Hide the button if there's no feedback to address
  if (issueCount === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" size="sm" className="whitespace-nowrap">
            <MessageSquarePlus className="size-4 mr-2" />
            Address Feedback
            {issueCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-primary-foreground/20">
                {issueCount}
              </span>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Address PR Feedback</DialogTitle>
          <DialogDescription>
            Create a task to address comments, fix failing checks, and resolve
            conflicts for PR #{feedback.prNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Action mode selection */}
          <div className="space-y-3">
            <Label>How would you like to address this feedback?</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as ActionMode)}
              className="grid grid-cols-2 gap-3"
            >
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  mode === "integrate"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="integrate" className="mt-0.5" />
                <div>
                  <div className="font-medium text-sm">Add to task queue</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add to current task&apos;s message queue
                  </p>
                </div>
              </label>
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  mode === "new-task"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="new-task" className="mt-0.5" />
                <div>
                  <div className="font-medium text-sm">Start as new task</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create a separate task to address feedback
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {mode === "new-task" && (
            <div className="space-y-2">
              <Label>Model</Label>
              <ModelSelector
                className="w-full"
                selectedModel={taskModel}
                selectedModels={{}}
                setSelectedModel={({ model }) => setTaskModel(model)}
                isMultiAgentMode={false}
                setIsMultiAgentMode={() => {}}
                supportsMultiAgentPromptSubmission={false}
                forcedAgent={null}
                forcedAgentVersion={null}
              />
            </div>
          )}

          {/* Merge instructions toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="merge-instructions"
              checked={includeMergeInstructions}
              onCheckedChange={(checked) =>
                setIncludeMergeInstructions(checked === true)
              }
            />
            <Label
              htmlFor="merge-instructions"
              className="text-sm font-normal cursor-pointer"
            >
              Include merge instructions (merge PR if all feedback is addressed)
            </Label>
          </div>

          {/* Autofix checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-fix-feedback"
              checked={autoFixFeedback}
              onCheckedChange={(checked) =>
                setAutoFixFeedback(checked === true)
              }
            />
            <div className="flex items-center gap-1.5">
              <Wrench className="size-3.5 text-muted-foreground" />
              <Label
                htmlFor="auto-fix-feedback"
                className="text-sm font-normal cursor-pointer"
              >
                Autofix: Automatically address new feedback on this PR
              </Label>
            </div>
          </div>

          {/* Automerge checkbox */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto-merge-pr"
                  checked={autoMergePR}
                  disabled={!canEnableAutoMerge}
                  onCheckedChange={(checked) =>
                    setAutoMergePR(checked === true)
                  }
                />
                <div className="flex items-center gap-1.5">
                  <GitMerge
                    className={`size-3.5 ${!canEnableAutoMerge ? "text-muted-foreground/50" : "text-muted-foreground"}`}
                  />
                  <Label
                    htmlFor="auto-merge-pr"
                    className={`text-sm font-normal cursor-pointer ${!canEnableAutoMerge ? "text-muted-foreground/50" : ""}`}
                  >
                    Automerge: Enable GitHub auto-merge when checks pass
                  </Label>
                </div>
              </div>
            </TooltipTrigger>
            {!canEnableAutoMerge && (
              <TooltipContent>
                <p>
                  Automerge requires all checks to pass, no unresolved comments,
                  and no conflicts
                </p>
              </TooltipContent>
            )}
          </Tooltip>

          {/* Task description preview/edit */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Task description</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit3 className="size-3.5 mr-1.5" />
                {isEditing ? "Preview" : "Edit"}
              </Button>
            </div>
            {isEditing ? (
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="min-h-[200px] font-mono text-xs"
              />
            ) : (
              <div className="p-3 rounded-lg border bg-muted/30 max-h-[250px] overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {generatedDescription}
                </pre>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <div className="size-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Rocket className="size-4 mr-2" />
            )}
            {mode === "new-task" ? "Create Task" : "Add to Queue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
