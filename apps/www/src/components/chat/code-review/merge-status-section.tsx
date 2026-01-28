"use client";

import React from "react";
import type { GithubPRMergeableState } from "@terragon/shared/db/types";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  GitMerge,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MergeStatusSectionProps {
  mergeableState: GithubPRMergeableState;
  hasConflicts: boolean;
  isMergeable: boolean;
  baseBranch: string;
  headBranch: string;
}

export function MergeStatusSection({
  mergeableState,
  hasConflicts,
  isMergeable,
  baseBranch,
  headBranch,
}: MergeStatusSectionProps) {
  const { icon, color, title, description } = getMergeStatusDisplay(
    mergeableState,
    hasConflicts,
    isMergeable,
  );

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
        </div>
      </div>

      {/* Conflict resolution guidance */}
      {hasConflicts && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <AlertTriangle className="size-4 text-yellow-600" />
            How to resolve conflicts
          </h4>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>
              Pull the latest changes from{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">
                {baseBranch}
              </code>
            </li>
            <li>Merge or rebase your branch onto {baseBranch}</li>
            <li>Resolve any conflicts in your editor</li>
            <li>Commit the resolved changes</li>
            <li>Push your branch to update this PR</li>
          </ol>
          <div className="mt-3 p-2 rounded bg-muted font-mono text-xs">
            <code>
              git fetch origin {baseBranch}
              <br />
              git merge origin/{baseBranch}
              <br />
              # resolve conflicts
              <br />
              git add .
              <br />
              git commit -m "Resolve merge conflicts"
              <br />
              git push
            </code>
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
    </div>
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
      title: "Merge conflicts",
      description:
        "This PR has conflicts with the base branch that must be resolved before merging.",
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
      };
    case "unstable":
      return {
        icon: <AlertTriangle className="size-5" />,
        color: "text-yellow-600",
        title: "Checks failing",
        description:
          "Some required checks are failing. Fix them before merging.",
      };
    case "unknown":
      return {
        icon: <HelpCircle className="size-5" />,
        color: "text-muted-foreground",
        title: "Merge status unknown",
        description:
          "GitHub is still calculating the merge status. Please wait a moment.",
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
