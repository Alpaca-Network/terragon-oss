"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useCallback, useEffect, useRef } from "react";
import { SquarePen, PanelLeftClose, Search, X } from "lucide-react";
import { ThreadListHeader, ThreadListContents, ThreadViewFilter } from "./main";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    isDashboardKanban,
  } = useCollapsibleThreadList();

  const [viewFilter, setViewFilter] = useState<ThreadViewFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
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

  // Track if user has manually expanded the sidebar in this session
  const hasUserExpandedRef = useRef(false);

  // Auto-collapse sidebar when entering kanban view on dashboard
  // But only if user hasn't manually expanded it
  useEffect(() => {
    if (
      isDashboardKanban &&
      !isThreadListCollapsed &&
      !hasUserExpandedRef.current
    ) {
      setThreadListCollapsed(true);
    }
  }, [isDashboardKanban, isThreadListCollapsed, setThreadListCollapsed]);

  // Reset the manual expand flag when leaving kanban view
  useEffect(() => {
    if (!isDashboardKanban) {
      hasUserExpandedRef.current = false;
    }
  }, [isDashboardKanban]);

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
          setViewFilter={(filter) => {
            setViewFilter(filter);
            // Clear search when switching away from archived
            if (filter !== "archived") {
              setSearchQuery("");
            }
          }}
          allowGroupBy={true}
        />
        {viewFilter === "archived" && (
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search archived tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-8 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
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
            searchQuery={viewFilter === "archived" ? searchQuery : undefined}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-30",
          isResizing && "bg-primary/50",
        )}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

/**
 * Hook to get a function to expand the sidebar (for use in kanban header)
 * This marks that user manually expanded it to prevent auto-collapse
 */
export function useExpandSidebar() {
  const {
    setThreadListCollapsed,
    isThreadListCollapsed,
    canCollapseThreadList,
  } = useCollapsibleThreadList();

  const expandSidebar = useCallback(() => {
    setThreadListCollapsed(false);
  }, [setThreadListCollapsed]);

  return {
    expandSidebar,
    isCollapsed: isThreadListCollapsed,
    canExpand: canCollapseThreadList && isThreadListCollapsed,
  };
}
