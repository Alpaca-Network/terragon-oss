"use client";

import { useCallback, useTransition } from "react";
import { useAtom } from "jotai";
import { useRouter, usePathname } from "next/navigation";
import { dashboardViewModeAtom } from "@/atoms/user-cookies";
import { Button } from "@/components/ui/button";
import { Kanban, LayoutList, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { markKanbanViewUsed } from "@/server-actions/user-flags";
import { DashboardViewMode } from "@/lib/cookies";

interface TaskViewToggleProps {
  className?: string;
  /** Thread ID to preserve when switching views. If provided, navigation will keep the task open. */
  threadId?: string;
}

export function TaskViewToggle({ className, threadId }: TaskViewToggleProps) {
  const [viewMode, setViewMode] = useAtom(dashboardViewModeAtom);
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const handleToggle = useCallback(
    (mode: DashboardViewMode) => {
      setViewMode(mode);

      // Track Kanban view usage
      if (mode === "kanban") {
        startTransition(async () => {
          try {
            await markKanbanViewUsed();
          } catch (error) {
            console.error("Failed to track Kanban view usage:", error);
          }
        });
      }

      // If we have a threadId, navigate to keep the task open
      // For Kanban, go to dashboard (Kanban will auto-select the task)
      // For List, go to the task page directly
      if (threadId) {
        if (mode === "kanban") {
          router.push(`/dashboard?task=${threadId}`);
        } else if (mode === "list") {
          router.push(`/task/${threadId}`);
        } else {
          // For new-project mode, just go to dashboard
          router.push("/dashboard");
        }
      } else if (pathname !== "/dashboard") {
        router.push("/dashboard");
      }
    },
    [setViewMode, router, pathname, threadId],
  );

  return (
    <div
      className={cn(
        "flex items-center gap-1 bg-muted/50 rounded-lg p-1",
        className,
      )}
    >
      <span className="text-xs text-muted-foreground px-2 hidden sm:inline">
        Task View:
      </span>
      <Button
        variant={viewMode === "new-project" ? "secondary" : "ghost"}
        size="sm"
        className={cn(
          "h-7 px-3 gap-1.5 text-xs",
          viewMode === "new-project" && "bg-background shadow-sm",
        )}
        onClick={() => handleToggle("new-project")}
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">New Project</span>
        <span className="sm:hidden">New</span>
      </Button>
      <Button
        variant={viewMode === "kanban" ? "secondary" : "ghost"}
        size="sm"
        className={cn(
          "h-7 px-3 gap-1.5 text-xs",
          viewMode === "kanban" && "bg-background shadow-sm",
        )}
        onClick={() => handleToggle("kanban")}
      >
        <Kanban className="h-3.5 w-3.5" />
        <span>Kanban</span>
      </Button>
      <Button
        variant={viewMode === "list" ? "secondary" : "ghost"}
        size="sm"
        className={cn(
          "h-7 px-3 gap-1.5 text-xs",
          viewMode === "list" && "bg-background shadow-sm",
        )}
        onClick={() => handleToggle("list")}
      >
        <LayoutList className="h-3.5 w-3.5" />
        <span>Inbox</span>
      </Button>
    </div>
  );
}
