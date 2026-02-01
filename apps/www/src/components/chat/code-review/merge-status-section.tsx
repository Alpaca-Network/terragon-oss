"use client";

import React, { useState, useMemo } from "react";
import type { GithubPRMergeableState } from "@terragon/shared/db/types";
import type { ThreadInfoFull } from "@terragon/shared";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  GitMerge,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
  Rocket,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { toast } from "sonner";
import { useServerActionMutation } from "@/queries/server-action-helpers";
import { newThread } from "@/server-actions/new-thread";
import { queueFollowUp, QueueFollowUpArgs } from "@/server-actions/follow-up";
import { getPrimaryThreadChat } from "@terragon/shared/utils/thread-utils";
import { useAtomValue } from "jotai";
import { selectedModelAtom } from "@/atoms/user-flags";
import { useAccessInfo } from "@/queries/subscription";
import { SUBSCRIPTION_MESSAGES } from "@/lib/subscription-msgs";

interface MergeStatusSectionProps {
  mergeableState: GithubPRMergeableState;
  hasConflicts: boolean;
  isMergeable: boolean;
  baseBranch: string;
  headBranch: string;
  prUrl?: string;
  prNumber?: number;
  repoFullName?: string;
  thread?: ThreadInfoFull;
}

export function MergeStatusSection({
  mergeableState,
  hasConflicts,
  isMergeable,
  baseBranch,
  headBranch,
  prUrl,
  prNumber,
  repoFullName,
  thread,
}: MergeStatusSectionProps) {
  const { icon, color, title, description, details } = getMergeStatusDisplay(
    mergeableState,
    hasConflicts,
    isMergeable,
  );

  const [showGitCommands, setShowGitCommands] = useState(false);
  const [copied, setCopied] = useState(false);

  const gitCommands = `git fetch origin ${baseBranch}
git merge origin/${baseBranch}
# resolve conflicts in your editor
git add .
git commit -m "Resolve merge conflicts"
git push`;

  const handleCopyCommands = () => {
    navigator.clipboard.writeText(gitCommands);
    setCopied(true);
    toast.success("Git commands copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const conflictResolutionUrl = prUrl ? `${prUrl}/conflicts` : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Branch info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
        <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
          {headBranch}
        </code>
        <span>→</span>
        <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
          {baseBranch}
        </code>
      </div>

      {/* Status card */}
      <div
        className={cn(
          "flex items-start gap-3 p-4 rounded-lg border",
          isMergeable
            ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
            : hasConflicts
              ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
              : "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900",
        )}
      >
        <div className={cn("flex-shrink-0 mt-0.5", color)}>{icon}</div>
        <div className="flex-1">
          <h4 className="text-sm font-medium">{title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
          {details && (
            <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
              {details.map((detail, i) => (
                <li key={i}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Conflict resolution section - expanded with more options */}
      {hasConflicts && (
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-600" />
              Resolve Merge Conflicts
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              This branch has conflicts with{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">
                {baseBranch}
              </code>{" "}
              that must be resolved before merging.
            </p>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {conflictResolutionUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={conflictResolutionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-3.5 mr-1.5" />
                    Resolve on GitHub
                  </a>
                </Button>
              )}

              {thread && prNumber && repoFullName && (
                <AskAgentToResolveDialog
                  thread={thread}
                  baseBranch={baseBranch}
                  headBranch={headBranch}
                  prNumber={prNumber}
                  repoFullName={repoFullName}
                />
              )}
            </div>

            {/* Collapsible git commands */}
            <div className="border-t pt-3 mt-3">
              <button
                onClick={() => setShowGitCommands(!showGitCommands)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {showGitCommands ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
                <span>Resolve via command line</span>
              </button>

              {showGitCommands && (
                <div className="mt-3 space-y-2">
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li>
                      Fetch the latest changes from{" "}
                      <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">
                        {baseBranch}
                      </code>
                    </li>
                    <li>Merge or rebase your branch</li>
                    <li>Resolve conflicts in your editor</li>
                    <li>Commit and push the resolved changes</li>
                  </ol>
                  <div className="relative mt-3 p-3 rounded bg-muted font-mono text-xs">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 size-7"
                      onClick={handleCopyCommands}
                    >
                      {copied ? (
                        <Check className="size-3.5 text-green-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                    <code className="whitespace-pre-wrap">{gitCommands}</code>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Blocked state guidance */}
      {mergeableState === "blocked" && !hasConflicts && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <ShieldAlert className="size-4 text-yellow-600" />
            Branch protection requirements
          </h4>
          <p className="text-sm text-muted-foreground">
            This PR is blocked by branch protection rules. Common requirements
            include:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
            <li>Required status checks must pass</li>
            <li>Required number of approving reviews</li>
            <li>No requested changes from reviewers</li>
            <li>Up-to-date with base branch</li>
          </ul>
        </div>
      )}

      {/* Unstable state guidance */}
      {mergeableState === "unstable" && !hasConflicts && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <AlertTriangle className="size-4 text-yellow-600" />
            Failing checks
          </h4>
          <p className="text-sm text-muted-foreground">
            Some required checks are failing or haven&apos;t completed yet.
            Review the Checks tab for details.
          </p>
        </div>
      )}

      {/* Ready to merge state */}
      {isMergeable && (
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="size-4" />
            Ready to merge
          </h4>
          <p className="text-sm text-muted-foreground">
            All checks have passed and there are no conflicts. You can use the
            Merge button above to merge this PR.
          </p>
        </div>
      )}
    </div>
  );
}

type ActionMode = "integrate" | "new-task";

function AskAgentToResolveDialog({
  thread,
  baseBranch,
  headBranch,
  prNumber,
  repoFullName,
}: {
  thread: ThreadInfoFull;
  baseBranch: string;
  headBranch: string;
  prNumber: number;
  repoFullName: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ActionMode>("integrate");
  const { isActive } = useAccessInfo();
  const selectedModel = useAtomValue(selectedModelAtom);

  const taskDescription = useMemo(() => {
    return `## Resolve Merge Conflicts

This PR (#${prNumber}) has merge conflicts with \`${baseBranch}\` that need to be resolved.

### Instructions

1. Fetch the latest changes from \`${baseBranch}\`
2. Merge \`origin/${baseBranch}\` into the current branch (\`${headBranch}\`)
3. Resolve any merge conflicts by examining the conflicting files
4. Choose the appropriate resolution for each conflict:
   - Keep the changes from this branch
   - Keep the changes from \`${baseBranch}\`
   - Combine both changes if appropriate
5. After resolving conflicts, commit and push the changes

### Important Notes
- Preserve the intent of both sets of changes where possible
- If unsure about a conflict, prefer keeping both changes and letting tests verify correctness
- Run any relevant tests after resolving conflicts to ensure nothing is broken`;
  }, [prNumber, baseBranch, headBranch]);

  const createNewThreadMutation = useServerActionMutation({
    mutationFn: newThread,
    onSuccess: () => {
      toast.success("New task created to resolve merge conflicts");
      setOpen(false);
    },
  });

  const addToQueueMutation = useServerActionMutation<QueueFollowUpArgs, void>({
    mutationFn: queueFollowUp,
    onSuccess: () => {
      toast.success("Conflict resolution added to task queue");
      setOpen(false);
    },
  });

  const handleSubmit = async () => {
    if (!isActive) {
      toast.error(SUBSCRIPTION_MESSAGES.CREATE_TASK);
      return;
    }

    const taskTitle = `Resolve merge conflicts for PR #${prNumber}`;

    if (mode === "new-task") {
      await createNewThreadMutation.mutateAsync({
        githubRepoFullName: repoFullName,
        branchName: headBranch,
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Rocket className="size-3.5 mr-1.5" />
          Ask Agent to Fix
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve Merge Conflicts</DialogTitle>
          <DialogDescription>
            Ask the agent to resolve merge conflicts for PR #{prNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 text-sm mb-2">
              <GitMerge className="size-4 text-muted-foreground" />
              <span className="font-medium">Conflict Details</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                Branch:{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">
                  {headBranch}
                </code>
              </p>
              <p>
                Target:{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">
                  {baseBranch}
                </code>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>How would you like to resolve?</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as ActionMode)}
              className="space-y-2"
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
                    The agent will resolve conflicts as the next action
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
                    Create a separate task to resolve conflicts
                  </p>
                </div>
              </label>
            </RadioGroup>
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

function getMergeStatusDisplay(
  mergeableState: GithubPRMergeableState,
  hasConflicts: boolean,
  isMergeable: boolean,
): {
  icon: React.ReactNode;
  color: string;
  title: string;
  description: string;
  details?: string[];
} {
  if (isMergeable) {
    return {
      icon: <CheckCircle2 className="size-5" />,
      color: "text-green-600",
      title: "Ready to merge",
      description:
        "This PR has no conflicts and all requirements are met. You can merge it now.",
    };
  }

  if (hasConflicts) {
    return {
      icon: <XCircle className="size-5" />,
      color: "text-red-600",
      title: "Merge conflicts detected",
      description:
        "This PR has conflicts with the base branch that must be resolved before merging.",
      details: [
        "Files have been modified in both branches",
        "Manual resolution required to combine changes",
        "Use one of the options below to resolve",
      ],
    };
  }

  switch (mergeableState) {
    case "blocked":
      return {
        icon: <ShieldAlert className="size-5" />,
        color: "text-yellow-600",
        title: "Blocked by requirements",
        description:
          "This PR is blocked by branch protection rules or required checks.",
        details: [
          "Check required status checks in the Checks tab",
          "Ensure required reviews are approved",
          "Verify branch is up-to-date if required",
        ],
      };
    case "unstable":
      return {
        icon: <AlertTriangle className="size-5" />,
        color: "text-yellow-600",
        title: "Checks failing",
        description:
          "Some required checks are failing. Fix them before merging.",
        details: [
          "Review failing checks in the Checks tab",
          "Address any test failures or linting issues",
          "Wait for pending checks to complete",
        ],
      };
    case "unknown":
      return {
        icon: <HelpCircle className="size-5" />,
        color: "text-muted-foreground",
        title: "Merge status unknown",
        description:
          "GitHub is still calculating the merge status. Please wait a moment and refresh.",
      };
    default:
      return {
        icon: <GitMerge className="size-5" />,
        color: "text-muted-foreground",
        title: "Not ready to merge",
        description: "Check the requirements above before merging.",
      };
  }
}
