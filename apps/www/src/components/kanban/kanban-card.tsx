"use client";

import { ThreadInfo } from "@terragon/shared";
import { memo, useMemo, useCallback, useState } from "react";
import { getThreadTitle } from "@/agent/thread-utils";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { ThreadStatusIndicator } from "../thread-status";
import { PRStatusPill } from "../pr-status-pill";
import { ThreadAgentIcon } from "../thread-agent-icon";
import { GitBranch, Play, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDraftThread } from "./types";
import { useSubmitDraftThreadMutation } from "@/queries/thread-mutations";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const KanbanCard = memo(function KanbanCard({
  thread,
  isSelected,
  onClick,
}: {
  thread: ThreadInfo;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [isStarting, setIsStarting] = useState(false);
  const submitDraftMutation = useSubmitDraftThreadMutation();
  const isDraft = useMemo(() => isDraftThread(thread), [thread]);
  const title = useMemo(() => getThreadTitle(thread), [thread]);
  const relativeTime = useMemo(
    () => formatRelativeTime(thread.updatedAt),
    [thread.updatedAt],
  );

  const handleStartTask = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!thread.draftMessage) {
        toast.error("No draft message found");
        return;
      }

      setIsStarting(true);
      try {
        await submitDraftMutation.mutateAsync({
          threadId: thread.id,
          userMessage: thread.draftMessage,
          selectedModels: {},
        });
        toast.success("Task started");
      } catch (error) {
        console.error("Failed to start task:", error);
        toast.error("Failed to start task");
      } finally {
        setIsStarting(false);
      }
    },
    [thread, submitDraftMutation],
  );

  return (
    <div
      onClick={onClick}
      className={cn(
        "group bg-card border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 relative",
        isSelected && "ring-2 ring-primary border-primary",
      )}
    >
      <div className="flex flex-col gap-2">
        {/* Header with status and title */}
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center mt-0.5">
            <ThreadStatusIndicator thread={thread} />
          </div>
          <h4 className="text-sm font-medium line-clamp-2 flex-1" title={title}>
            {title}
          </h4>
        </div>

        {/* Repository info */}
        {thread.githubRepoFullName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="size-3 flex-shrink-0" />
            <span className="truncate" title={thread.githubRepoFullName}>
              {thread.githubRepoFullName}
            </span>
          </div>
        )}

        {/* Footer with metadata */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span
            className="text-xs text-muted-foreground"
            title={new Date(thread.updatedAt).toLocaleString()}
          >
            {relativeTime}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {thread.githubPRNumber && thread.prStatus && (
              <PRStatusPill
                status={thread.prStatus}
                checksStatus={thread.prChecksStatus}
                prNumber={thread.githubPRNumber}
                repoFullName={thread.githubRepoFullName}
              />
            )}
            <ThreadAgentIcon thread={thread} />
          </div>
        </div>
      </div>

      {/* Start Task button - shown on hover for draft tasks */}
      {isDraft && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="h-7 w-7"
                onClick={handleStartTask}
                disabled={isStarting}
              >
                {isStarting ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Start task</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
});
