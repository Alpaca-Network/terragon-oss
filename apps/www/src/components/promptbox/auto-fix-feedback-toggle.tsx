"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AutoFixFeedbackToggleProps {
  disabled?: boolean;
  disableToast?: boolean;
  value: boolean;
  onChange: (enabled: boolean) => void;
}

export function AutoFixFeedbackToggle({
  disabled,
  disableToast,
  value,
  onChange,
}: AutoFixFeedbackToggleProps) {
  const autoFixEnabled = value;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className={cn(
            autoFixEnabled
              ? "text-muted-foreground hover:text-muted-foreground"
              : "opacity-50 hover:opacity-50",
          )}
          aria-pressed={autoFixEnabled}
          aria-label={
            autoFixEnabled
              ? "Disable auto-fix feedback"
              : "Enable auto-fix feedback"
          }
          disabled={disabled}
          onClick={() => {
            if (disabled) {
              return;
            }
            const newValue = !autoFixEnabled;
            onChange(newValue);
            if (!disableToast) {
              toast.success(
                newValue
                  ? "Auto-fix feedback enabled"
                  : "Auto-fix feedback disabled",
              );
            }
          }}
        >
          <Wrench
            className={cn("h-4 w-4", {
              "opacity-50": !autoFixEnabled,
            })}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {autoFixEnabled
          ? "Auto-fix: ON - Will automatically address PR comments and failing checks"
          : "Auto-fix: OFF - Enable to automatically address PR feedback"}
      </TooltipContent>
    </Tooltip>
  );
}
