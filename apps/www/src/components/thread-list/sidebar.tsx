"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useCallback } from "react";
import { SquarePen, PanelLeftClose } from "lucide-react";
import {
  ThreadListHeader,
  ThreadListContents,
  ThreadViewFilter,
  FeedbackFilter,
} from "./main";
import { Button } from "@/components/ui/button";
import { useCollapsibleThreadList } from "./use-collapsible-thread-list";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { headerClassName } from "../shared/header";
import { useAtomValue, useSetAtom } from "jotai";
import {
  dashboardViewModeAtom,
  kanbanNewTaskDialogOpenAtom,
} from "@/atoms/user-cookies";
import { useRouter, usePathname } from "next/navigation";

const TASK_PANEL_MIN_WIDTH = 250;
const TASK_PANEL_MAX_WIDTH = 600; // Maximum width in pixels
const TASK_PANEL_DEFAULT_WIDTH = 320;

export function ThreadListSidebar() {
  const {
    canCollapseThreadList,
    isThreadListCollapsed,
    setThreadListCollapsed,
  } = useCollapsibleThreadList();

  const [viewFilter, setViewFilter] = useState<ThreadViewFilter>("active");
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>("all");
  const viewMode = useAtomValue(dashboardViewModeAtom);
  const setKanbanNewTaskDialogOpen = useSetAtom(kanbanNewTaskDialogOpenAtom);
  const router = useRouter();
  const pathname = usePathname();

  const { width, isResizing, handleMouseDown } = useResizablePanel({
    minWidth: TASK_PANEL_MIN_WIDTH,
    maxWidth: TASK_PANEL_MAX_WIDTH,
    defaultWidth: TASK_PANEL_DEFAULT_WIDTH,
    mode: "fixed",
    direction: "ltr",
  });

  // Handle "New Task" button click based on current view mode
  const handleNewTaskClick = useCallback(
    (e: React.MouseEvent) => {
      // If we're in kanban mode and on the dashboard, open the dialog
      if (viewMode === "kanban" && pathname === "/dashboard") {
        e.preventDefault();
        setKanbanNewTaskDialogOpen(true);
      } else if (viewMode === "kanban") {
        // If we're in kanban mode but not on dashboard, navigate and then open dialog
        e.preventDefault();
        router.push("/dashboard");
        // The dialog will be opened by the dashboard component detecting the atom change
        setTimeout(() => setKanbanNewTaskDialogOpen(true), 100);
      }
      // Otherwise, let the Link handle navigation normally (list view)
    },
    [viewMode, pathname, setKanbanNewTaskDialogOpen, router],
  );

  // Don't render the sidebar if it should be collapsed
  if (isThreadListCollapsed) {
    return null;
  }
  return (
    <div
      className="hidden lg:flex sticky top-0 h-screen border-r bg-sidebar flex-shrink-0"
      style={{ width: `${width}px` }}
    >
      {/* Content */}
      <div className="flex flex-col h-full w-full overflow-hidden">
        <div
          className={cn("p-2 flex items-center gap-2 mb-2", headerClassName)}
        >
          <Link
            href="/dashboard"
            onClick={handleNewTaskClick}
            className="flex-1 flex items-center gap-2 rounded-md transition-colors hover:bg-sidebar-accent/50 p-2 text-sm"
          >
            <SquarePen className="h-4 w-4" />
            <span>New Task</span>
          </Link>
          {canCollapseThreadList && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setThreadListCollapsed(true)}
              className="h-8 w-8 flex-shrink-0"
              title="Collapse task list"
            >
              <PanelLeftClose className="h-4 w-4 opacity-50" />
            </Button>
          )}
        </div>
        <ThreadListHeader
          viewFilter={viewFilter}
          setViewFilter={setViewFilter}
          allowGroupBy={true}
          feedbackFilter={feedbackFilter}
          onFeedbackFilterChange={setFeedbackFilter}
          showFeedbackFilters={true}
        />
        <div
          className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-border/80"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "hsl(var(--border) / 0.5) transparent",
          }}
        >
          <ThreadListContents
            viewFilter={viewFilter}
            queryFilters={
              viewFilter === "archived"
                ? { archived: true }
                : viewFilter === "backlog"
                  ? { isBacklog: true }
                  : { archived: false, isBacklog: false }
            }
            allowGroupBy={true}
            showSuggestedTasks={false}
            setPromptText={() => {}}
            isSidebar={true}
            feedbackFilter={feedbackFilter}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-30",
          isResizing && "bg-blue-500/50",
        )}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
