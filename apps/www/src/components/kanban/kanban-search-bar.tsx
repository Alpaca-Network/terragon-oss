"use client";

import { memo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const KanbanSearchBar = memo(function KanbanSearchBar({
  value,
  onChange,
  placeholder = "Search tasks...",
  className,
  inputClassName,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className={cn(
          "absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
          compact ? "h-3.5 w-3.5" : "h-4 w-4",
        )}
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "pr-8",
          compact ? "h-8 pl-8 text-xs" : "h-9 pl-9 text-sm",
          inputClassName,
        )}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange("")}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2",
            compact ? "h-6 w-6" : "h-7 w-7",
          )}
          aria-label="Clear search"
        >
          <X className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </Button>
      )}
    </div>
  );
});
