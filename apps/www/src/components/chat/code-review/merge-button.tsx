"use client";

import React, { useState } from "react";
import {
  GitMerge,
  ChevronDown,
  CheckCircle2,
  Loader2,
  Zap,
  ZapOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useServerActionMutation } from "@/queries/server-action-helpers";
import { mergePR, type MergeMethod } from "@/server-actions/merge-pr";
import {
  enableAutoMerge,
  disableAutoMerge,
} from "@/server-actions/auto-merge-pr";

interface MergeButtonProps {
  repoFullName: string;
  prNumber: number;
  prTitle: string;
  isMergeable: boolean;
  isAutoMergeEnabled?: boolean;
  threadId?: string;
  onMerged?: () => void;
  onAutoMergeChanged?: () => void;
}

const MERGE_METHODS: {
  value: MergeMethod;
  label: string;
  description: string;
}[] = [
  {
    value: "squash",
    label: "Squash and merge",
    description: "Combine all commits into one",
  },
  {
    value: "merge",
    label: "Create a merge commit",
    description: "All commits will be added with a merge commit",
  },
  {
    value: "rebase",
    label: "Rebase and merge",
    description: "Add all commits onto base branch",
  },
];

export function MergeButton({
  repoFullName,
  prNumber,
  prTitle,
  isMergeable,
  isAutoMergeEnabled = false,
  threadId,
  onMerged,
  onAutoMergeChanged,
}: MergeButtonProps) {
  const [selectedMethod, setSelectedMethod] = useState<MergeMethod>("squash");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showAutoMergeConfirmDialog, setShowAutoMergeConfirmDialog] =
    useState(false);
  const [mergeResult, setMergeResult] = useState<{ sha?: string } | null>(null);

  const mergeMutation = useServerActionMutation({
    mutationFn: mergePR,
    onSuccess: (result) => {
      if (result.merged) {
        setMergeResult({ sha: result.sha });
        setShowSuccessDialog(true);
        onMerged?.();
      } else {
        toast.error(result.message || "Failed to merge PR");
      }
    },
  });

  const enableAutoMergeMutation = useServerActionMutation({
    mutationFn: enableAutoMerge,
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Auto-merge enabled. PR will merge when checks pass.");
        onAutoMergeChanged?.();
      } else {
        toast.error(result.message || "Failed to enable auto-merge");
      }
    },
  });

  const disableAutoMergeMutation = useServerActionMutation({
    mutationFn: disableAutoMerge,
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Auto-merge disabled");
        onAutoMergeChanged?.();
      } else {
        toast.error(result.message || "Failed to disable auto-merge");
      }
    },
  });

  const handleMerge = () => {
    setShowConfirmDialog(false);
    mergeMutation.mutate({
      repoFullName,
      prNumber,
      mergeMethod: selectedMethod,
      threadId,
    });
  };

  const handleEnableAutoMerge = () => {
    setShowAutoMergeConfirmDialog(false);
    enableAutoMergeMutation.mutate({
      repoFullName,
      prNumber,
      mergeMethod: selectedMethod,
    });
  };

  const handleDisableAutoMerge = () => {
    disableAutoMergeMutation.mutate({
      repoFullName,
      prNumber,
    });
  };

  const selectedMethodInfo = MERGE_METHODS.find(
    (m) => m.value === selectedMethod,
  );

  const isPending =
    mergeMutation.isPending ||
    enableAutoMergeMutation.isPending ||
    disableAutoMergeMutation.isPending;

  return (
    <>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <Button
          onClick={() => setShowConfirmDialog(true)}
          disabled={!isMergeable || isPending}
          className="rounded-r-none whitespace-nowrap"
        >
          {isPending ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <GitMerge className="size-4 mr-2" />
          )}
          Merge PR
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="rounded-l-none border-l border-primary-foreground/20"
              disabled={isPending}
            >
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {MERGE_METHODS.map((method) => (
              <DropdownMenuItem
                key={method.value}
                onClick={() => setSelectedMethod(method.value)}
                className="flex flex-col items-start gap-0.5"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="font-medium">{method.label}</span>
                  {selectedMethod === method.value && (
                    <CheckCircle2 className="size-4 ml-auto text-green-600" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {method.description}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {isAutoMergeEnabled ? (
              <DropdownMenuItem
                onClick={handleDisableAutoMerge}
                className="flex flex-col items-start gap-0.5"
                disabled={disableAutoMergeMutation.isPending}
              >
                <div className="flex items-center gap-2 w-full">
                  <ZapOff className="size-4 text-muted-foreground" />
                  <span className="font-medium">Disable auto-merge</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Cancel automatic merge when checks pass
                </span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => setShowAutoMergeConfirmDialog(true)}
                className="flex flex-col items-start gap-0.5"
                disabled={enableAutoMergeMutation.isPending}
              >
                <div className="flex items-center gap-2 w-full">
                  <Zap className="size-4 text-amber-500" />
                  <span className="font-medium">Enable auto-merge</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Merge automatically when checks pass
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge pull request?</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>You are about to merge PR #{prNumber}:</p>
              <p className="font-medium text-foreground">{prTitle}</p>
              <p className="text-sm">
                Method:{" "}
                <span className="font-medium">{selectedMethodInfo?.label}</span>
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleMerge}>
              <GitMerge className="size-4 mr-2" />
              Confirm merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-merge Confirmation Dialog */}
      <Dialog
        open={showAutoMergeConfirmDialog}
        onOpenChange={setShowAutoMergeConfirmDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-amber-500" />
              Enable auto-merge?
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                PR #{prNumber} will be automatically merged when all conditions
                are met:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>All required status checks pass</li>
                <li>All required reviews are approved</li>
                <li>No merge conflicts exist</li>
              </ul>
              <p className="text-sm">
                Merge method:{" "}
                <span className="font-medium">{selectedMethodInfo?.label}</span>
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAutoMergeConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleEnableAutoMerge}>
              <Zap className="size-4 mr-2" />
              Enable auto-merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="size-5" />
              PR merged successfully!
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>PR #{prNumber} has been merged into the base branch.</p>
              {mergeResult?.sha && (
                <p className="text-xs font-mono text-muted-foreground">
                  Merge commit: {mergeResult.sha.slice(0, 7)}
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
