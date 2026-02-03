"use client";

import { Kanban, X } from "lucide-react";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import {
  dismissedKanbanPromotionAtom,
  dashboardViewModeAtom,
} from "@/atoms/user-cookies";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import { hasUsedKanbanViewAtom } from "@/atoms/user-flags";

export function KanbanPromotionBanner() {
  const [isDismissed, setIsDismissed] = useAtom(dismissedKanbanPromotionAtom);
  const setViewMode = useSetAtom(dashboardViewModeAtom);
  const hasUsedKanbanView = useAtomValue(hasUsedKanbanViewAtom);
  const posthog = usePostHog();

  // Don't show if dismissed or user has already used Kanban view
  if (isDismissed || hasUsedKanbanView) {
    return null;
  }

  const handleSwitchToKanban = () => {
    setViewMode("kanban");
    setIsDismissed(true);

    posthog?.capture("kanban_promotion_clicked");
    toast.success("Switched to Kanban view!");
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    posthog?.capture("kanban_promotion_dismissed");
  };

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Kanban className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">Try Kanban View</p>
          <p className="text-xs text-muted-foreground mt-1">
            Organize your tasks visually across To Do, In Progress, and Done
            columns
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwitchToKanban}
            className="mt-2"
          >
            <Kanban className="h-4 w-4 mr-2" />
            Switch to Kanban
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
