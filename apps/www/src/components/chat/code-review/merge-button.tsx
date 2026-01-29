"use client";

import React, { useState } from "react";
import { GitMerge, ChevronDown, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

interface MergeButtonProps {
  repoFullName: string;
  prNumber: number;
  prTitle: string;
  isMergeable: boolean;
  threadId?: string;
  onMerged?: () => void;
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
  threadId,
  onMerged,
}: MergeButtonProps) {
  const [selectedMethod, setSelectedMethod] = useState<MergeMethod>("squash");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
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

  const handleMerge = () => {
    setShowConfirmDialog(false);
    mergeMutation.mutate({
      repoFullName,
      prNumber,
      mergeMethod: selectedMethod,
      threadId,
    });
  };

  const selectedMethodInfo = MERGE_METHODS.find(
    (m) => m.value === selectedMethod,
  );

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          onClick={() => setShowConfirmDialog(true)}
          disabled={!isMergeable || mergeMutation.isPending}
          className="rounded-r-none"
        >
          {mergeMutation.isPending ? (
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
              disabled={!isMergeable || mergeMutation.isPending}
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
