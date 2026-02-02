"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { KanbanCard } from "./kanban-card";
import { KanbanColumn as KanbanColumnType, KANBAN_COLUMNS } from "./types";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const COLUMN_SCROLL_HINT_THRESHOLD_PX = 24;

export const shouldShowScrollHint = (
  scrollHeight: number,
  clientHeight: number,
  threshold = COLUMN_SCROLL_HINT_THRESHOLD_PX,
) => scrollHeight > clientHeight + threshold;

export const KanbanColumn = memo(function KanbanColumn({
  column,
  threads,
  selectedThreadId,
  onThreadSelect,
  onAddToBacklog,
  onThreadCommentsClick,
  showArchivedToggle,
  showArchived,
  onToggleArchived,
  showNavigation,
  canNavigateLeft,
  canNavigateRight,
  onNavigateLeft,
  onNavigateRight,
}: {
  column: KanbanColumnType;
  threads: ThreadInfo[];
  selectedThreadId: string | null;
  onThreadSelect: (thread: ThreadInfo) => void;
  onAddToBacklog?: () => void;
  onThreadCommentsClick?: (thread: ThreadInfo) => void;
  showArchivedToggle?: boolean;
  showArchived?: boolean;
  onToggleArchived?: () => void;
  showNavigation?: boolean;
  canNavigateLeft?: boolean;
  canNavigateRight?: boolean;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
}) {
  const columnConfig = KANBAN_COLUMNS.find((c) => c.id === column);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

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
        return "bg-primary/10 text-primary border border-primary/20";
      case "done":
        return "bg-primary/10 text-primary border border-primary/20";
      case "failed":
        return "bg-destructive/10 text-destructive border border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const viewport = scrollContainer.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLDivElement | null;
    if (!viewport) return;

    const updateHint = () => {
      setShowScrollHint(
        shouldShowScrollHint(viewport.scrollHeight, viewport.clientHeight),
      );
    };

    updateHint();
    viewport.addEventListener("scroll", updateHint);

    const resizeObserver = new ResizeObserver(updateHint);
    resizeObserver.observe(viewport);
    if (viewport.firstElementChild) {
      resizeObserver.observe(viewport.firstElementChild);
    }

    return () => {
      viewport.removeEventListener("scroll", updateHint);
      resizeObserver.disconnect();
    };
  }, [threads.length]);

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
          {showNavigation && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigateLeft}
              disabled={!canNavigateLeft}
              className="h-6 w-6"
              title="Previous column"
              aria-label="Previous column"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <span>{columnConfig.title}</span>
          <span className="text-xs opacity-70 bg-muted/50 px-1.5 py-0.5 rounded-full">
            {threads.length}
          </span>
          {showNavigation && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigateRight}
              disabled={!canNavigateRight}
              className="h-6 w-6"
              title="Next column"
              aria-label="Next column"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {column === "backlog" && onAddToBacklog && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full hover:bg-muted/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToBacklog();
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Add to backlog</TooltipContent>
            </Tooltip>
          )}
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
      </div>

      {/* Column content */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 bg-muted/30 rounded-b-lg border border-t-0 min-h-0"
      >
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
        {showScrollHint && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0">
            <div className="h-10 bg-gradient-to-t from-background/90 to-transparent" />
            <div className="absolute inset-x-0 bottom-1 text-center text-[11px] text-muted-foreground">
              Scroll for more
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
