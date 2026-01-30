"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { KanbanCard } from "./kanban-card";
import { KanbanColumn as KanbanColumnType, KANBAN_COLUMNS } from "./types";
import { Archive, ArchiveRestore } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const KanbanColumn = memo(function KanbanColumn({
  column,
  threads,
  selectedThreadId,
  onThreadSelect,
  onThreadCommentsClick,
  showArchivedToggle,
  showArchived,
  onToggleArchived,
}: {
  column: KanbanColumnType;
  threads: ThreadInfo[];
  selectedThreadId: string | null;
  onThreadSelect: (thread: ThreadInfo) => void;
  onThreadCommentsClick?: (thread: ThreadInfo) => void;
  showArchivedToggle?: boolean;
  showArchived?: boolean;
  onToggleArchived?: () => void;
}) {
  const columnConfig = KANBAN_COLUMNS.find((c) => c.id === column);

  if (!columnConfig) {
    return null;
  }

  const getColumnHeaderColor = (columnId: KanbanColumnType) => {
    switch (columnId) {
      case "backlog":
        return "bg-muted text-muted-foreground";
      case "in_progress":
        return "bg-primary/10 text-primary border border-primary/20";
      case "in_review":
        return "bg-accent/10 text-accent-foreground border border-accent/20";
      case "done":
        return "bg-primary/10 text-primary border border-primary/20";
      case "cancelled":
        return "bg-destructive/10 text-destructive border border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[320px] flex-1">
      {/* Column header */}
      <div
        className={cn(
          "px-3 py-2 rounded-t-lg font-medium text-sm flex items-center justify-between",
          getColumnHeaderColor(column),
        )}
      >
        <div className="flex items-center gap-2">
          <span>{columnConfig.title}</span>
          <span className="text-xs opacity-70 bg-muted/50 px-1.5 py-0.5 rounded-full">
            {threads.length}
          </span>
        </div>
        {showArchivedToggle && onToggleArchived && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-6 w-6", showArchived && "bg-muted/50")}
                onClick={onToggleArchived}
              >
                {showArchived ? (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {showArchived ? "Hide archived tasks" : "Show archived tasks"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Column content */}
      <div className="flex-1 bg-muted/30 rounded-b-lg border border-t-0 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-2">
            {threads.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No tasks
              </div>
            ) : (
              threads.map((thread) => (
                <KanbanCard
                  key={thread.id}
                  thread={thread}
                  isSelected={selectedThreadId === thread.id}
                  onClick={() => onThreadSelect(thread)}
                  onCommentsClick={() => onThreadCommentsClick?.(thread)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
});
