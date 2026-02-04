"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { GitMerge } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AutoMergeToggleProps {
  disabled?: boolean;
  disableToast?: boolean;
  value: boolean;
  onChange: (enabled: boolean) => void;
}

export function AutoMergeToggle({
  disabled,
  disableToast,
  value,
  onChange,
}: AutoMergeToggleProps) {
  const autoMergeEnabled = value;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className={cn(
            autoMergeEnabled
              ? "text-muted-foreground hover:text-muted-foreground"
              : "opacity-50 hover:opacity-50",
          )}
          aria-pressed={autoMergeEnabled}
          aria-label={
            autoMergeEnabled ? "Disable auto-merge PR" : "Enable auto-merge PR"
          }
          disabled={disabled}
          onClick={() => {
            if (disabled) {
              return;
            }
            const newValue = !autoMergeEnabled;
            onChange(newValue);
            if (!disableToast) {
              toast.success(
                newValue ? "Auto-merge PR enabled" : "Auto-merge PR disabled",
              );
            }
          }}
        >
          <GitMerge
            className={cn("h-4 w-4", {
              "opacity-50": !autoMergeEnabled,
            })}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {autoMergeEnabled
          ? "Auto-merge: ON - Will enable GitHub auto-merge when all feedback is addressed"
          : "Auto-merge: OFF - Enable to auto-merge PR when ready"}
      </TooltipContent>
    </Tooltip>
  );
}
