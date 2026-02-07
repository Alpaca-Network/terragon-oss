"use client";

import React, { memo, useState } from "react";
import { GitBranch, Github, ChevronDown } from "lucide-react";
import { RepoBranchSelector } from "@/components/repo-branch-selector";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RepoBranchHeaderProps {
  selectedRepoFullName: string | null;
  selectedBranch: string | null;
  onChange: (repoFullName: string | null, branch: string | null) => void;
  className?: string;
  placeholder?: string;
}

function RepoBranchHeaderInner({
  selectedRepoFullName,
  selectedBranch,
  onChange,
  className,
  placeholder = "Select repository...",
}: RepoBranchHeaderProps) {
  const [open, setOpen] = useState(false);

  // Extract repo name for display (owner/repo -> repo)
  const repoDisplayName = selectedRepoFullName?.split("/")[1] || null;

  const handleChange = (repoFullName: string | null, branch: string | null) => {
    onChange(repoFullName, branch);
    // Close popover after selection
    if (repoFullName && branch) {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-start gap-2 px-3 py-2 h-auto font-normal hover:bg-muted/50",
            className,
          )}
        >
          {selectedRepoFullName ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5">
                <Github className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{repoDisplayName}</span>
              </span>
              {selectedBranch && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>{selectedBranch}</span>
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-2">
          <RepoBranchSelector
            selectedRepoFullName={selectedRepoFullName}
            selectedBranch={selectedBranch}
            onChange={handleChange}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const RepoBranchHeader = memo(RepoBranchHeaderInner);
