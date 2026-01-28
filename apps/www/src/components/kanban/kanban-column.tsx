"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanCard } from "./kanban-card";
import { KanbanColumn as KanbanColumnType, KANBAN_COLUMNS } from "./types";

export const KanbanColumn = memo(function KanbanColumn({
  column,
  threads,
  selectedThreadId,
  onThreadSelect,
}: {
  column: KanbanColumnType;
  threads: ThreadInfo[];
  selectedThreadId: string | null;
  onThreadSelect: (thread: ThreadInfo) => void;
}) {
  const columnConfig = KANBAN_COLUMNS.find((c) => c.id === column);

  if (!columnConfig) {
    return null;
  }

  const getColumnHeaderColor = (columnId: KanbanColumnType) => {
    switch (columnId) {
      case "backlog":
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
      case "in_progress":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
      case "in_review":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
      case "done":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
      case "cancelled":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
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
        <span>{columnConfig.title}</span>
        <span className="text-xs opacity-70 bg-white/30 dark:bg-black/20 px-1.5 py-0.5 rounded-full">
          {threads.length}
        </span>
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
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
});
