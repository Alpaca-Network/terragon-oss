"use client";

import React, { useCallback } from "react";
import { Button } from "../../ui/button";
import { RefreshCw, Square, Check } from "lucide-react";
import { useThread } from "../thread-context";
import { toast } from "sonner";
import {
  approveLoopIteration,
  stopLoop,
} from "@/server-actions/loop-iteration";
import { useServerActionMutation } from "@/queries/server-action-helpers";
import { useAccessInfo } from "@/queries/subscription";
import { SUBSCRIPTION_MESSAGES } from "@/lib/subscription-msgs";
import { useOptimisticUpdateThreadChat } from "../hooks";
import { LoopConfig } from "@terragon/shared/db/schema";

interface LoopIterationApprovalProps {
  loopConfig: LoopConfig;
}

/**
 * UI component that shows when a loop mode task is awaiting user approval
 * to continue to the next iteration.
 */
export function LoopIterationApproval({
  loopConfig,
}: LoopIterationApprovalProps) {
  const { isActive } = useAccessInfo();
  const { threadChat, isReadOnly } = useThread();
  const updateThreadChat = useOptimisticUpdateThreadChat({
    threadId: threadChat?.threadId,
    threadChatId: threadChat?.id,
  });

  const approveIterationMutation = useServerActionMutation({
    mutationFn: approveLoopIteration,
  });

  const stopLoopMutation = useServerActionMutation({
    mutationFn: stopLoop,
  });

  const handleContinue = useCallback(async () => {
    if (isReadOnly || !threadChat) {
      return;
    }
    if (!isActive) {
      toast.error(SUBSCRIPTION_MESSAGES.FOLLOW_UP);
      return;
    }
    // Optimistically update the loopConfig
    updateThreadChat({
      loopConfig: {
        ...loopConfig,
        currentIteration: loopConfig.currentIteration + 1,
        awaitingApproval: false,
      },
    });
    await approveIterationMutation.mutateAsync({
      threadId: threadChat.threadId,
      threadChatId: threadChat.id,
    });
  }, [
    isReadOnly,
    threadChat,
    isActive,
    loopConfig,
    updateThreadChat,
    approveIterationMutation,
  ]);

  const handleStop = useCallback(async () => {
    if (isReadOnly || !threadChat) {
      return;
    }
    // Optimistically update the loopConfig
    updateThreadChat({
      loopConfig: {
        ...loopConfig,
        isLoopActive: false,
        awaitingApproval: false,
      },
    });
    await stopLoopMutation.mutateAsync({
      threadId: threadChat.threadId,
      threadChatId: threadChat.id,
    });
    toast.success("Loop stopped");
  }, [isReadOnly, threadChat, loopConfig, updateThreadChat, stopLoopMutation]);

  if (!loopConfig.awaitingApproval) {
    return null;
  }

  const nextIteration = loopConfig.currentIteration + 1;
  const isLastIteration = nextIteration >= loopConfig.maxIterations;

  return (
    <div className="mx-4 my-3 p-4 bg-muted/50 rounded-lg border border-border">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-full">
          <RefreshCw className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground">
            Loop Iteration {loopConfig.currentIteration}/
            {loopConfig.maxIterations} Complete
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {isLastIteration ? (
              <>Max iterations reached. The loop will end.</>
            ) : (
              <>
                Completion signal &quot;{loopConfig.completionPromise}&quot; not
                detected.
              </>
            )}
          </p>
          {!isReadOnly && !isLastIteration && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleContinue}
                className="flex items-center gap-2"
                disabled={approveIterationMutation.isPending}
              >
                <Check className="h-3.5 w-3.5" />
                Continue to Iteration {nextIteration}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleStop}
                className="flex items-center gap-2"
                disabled={stopLoopMutation.isPending}
              >
                <Square className="h-3.5 w-3.5" />
                Stop Loop
              </Button>
            </div>
          )}
          {!isReadOnly && isLastIteration && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleStop}
                className="flex items-center gap-2"
                disabled={stopLoopMutation.isPending}
              >
                <Check className="h-3.5 w-3.5" />
                End Loop
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
