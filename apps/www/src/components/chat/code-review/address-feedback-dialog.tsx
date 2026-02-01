"use client";

import React, { useState, useMemo } from "react";
import { Rocket, MessageSquarePlus, Edit3 } from "lucide-react";
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
import { toast } from "sonner";
import { useServerActionMutation } from "@/queries/server-action-helpers";
import { newThread } from "@/server-actions/new-thread";
import { queueFollowUp, QueueFollowUpArgs } from "@/server-actions/follow-up";
import { getPrimaryThreadChat } from "@terragon/shared/utils/thread-utils";
import { useAtomValue } from "jotai";
import { selectedModelAtom } from "@/atoms/user-flags";
import { useAccessInfo } from "@/queries/subscription";
import { SUBSCRIPTION_MESSAGES } from "@/lib/subscription-msgs";
import type { PRFeedback } from "@terragon/shared/db/types";
import type { ThreadInfoFull } from "@terragon/shared";
import { generateFeedbackTaskDescription } from "@/lib/feedback-task-template";

type ActionMode = "new-task" | "integrate";

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
  const { isActive } = useAccessInfo();
  const selectedModel = useAtomValue(selectedModelAtom);

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

    if (mode === "new-task") {
      await createNewThreadMutation.mutateAsync({
        githubRepoFullName: feedback.repoFullName,
        branchName: feedback.headBranch,
        sourceType: "www-address-pr-feedback",
        parentThreadId: thread.id,
        message: {
          type: "user",
          model: selectedModel,
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
        messages: [
          {
            type: "user",
            model: selectedModel,
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
