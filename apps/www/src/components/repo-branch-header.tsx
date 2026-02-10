"use client";

import React, { memo } from "react";
import { RepoBranchSelector } from "@/components/repo-branch-selector";
import { cn } from "@/lib/utils";

interface RepoBranchHeaderProps {
  selectedRepoFullName: string | null;
  selectedBranch: string | null;
  onChange: (repoFullName: string | null, branch: string | null) => void;
  className?: string;
}

function RepoBranchHeaderInner({
  selectedRepoFullName,
  selectedBranch,
  onChange,
  className,
}: RepoBranchHeaderProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <RepoBranchSelector
        selectedRepoFullName={selectedRepoFullName}
        selectedBranch={selectedBranch}
        onChange={onChange}
      />
    </div>
  );
}

export const RepoBranchHeader = memo(RepoBranchHeaderInner);
