"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { DBUserMessage } from "@terragon/shared";
import { queueFollowUpInternal } from "@/server-lib/follow-up";
import { getAccessInfoForUser } from "@/lib/subscription";
import { SUBSCRIPTION_MESSAGES } from "@/lib/subscription-msgs";
import {
  getThreadChat,
  updateThreadChat,
} from "@terragon/shared/model/threads";
import { db } from "@/lib/db";
import { UserFacingError } from "@/lib/server-actions";

/**
 * Approve the next iteration of a loop mode task
 */
export const approveLoopIteration = userOnlyAction(
  async function approveLoopIteration(
    userId: string,
    {
      threadId,
      threadChatId,
    }: {
      threadId: string;
      threadChatId: string;
    },
  ) {
    console.log("approveLoopIteration", { threadId, threadChatId });
    const { tier } = await getAccessInfoForUser(userId);
    if (tier === "none") {
      throw new UserFacingError(SUBSCRIPTION_MESSAGES.FOLLOW_UP);
    }
    const threadChat = await getThreadChat({
      db,
      threadId,
      userId,
      threadChatId,
    });
    if (!threadChat) {
      throw new UserFacingError("Task not found");
    }
    if (
      threadChat.permissionMode !== "loop" ||
      !threadChat.loopConfig?.isLoopActive
    ) {
      throw new UserFacingError("Task is not in loop mode");
    }
    if (!threadChat.loopConfig.awaitingApproval) {
      throw new UserFacingError("Task is not awaiting approval");
    }

    const loopConfig = threadChat.loopConfig;
    const nextIteration = loopConfig.currentIteration + 1;

    // Update loopConfig: awaitingApproval=false, currentIteration++
    await updateThreadChat({
      db,
      userId,
      threadId,
      threadChatId,
      updates: {
        loopConfig: {
          ...loopConfig,
          currentIteration: nextIteration,
          awaitingApproval: false,
        },
      },
    });

    // Queue continuation message
    const message: DBUserMessage = {
      type: "user",
      model: null,
      parts: [
        {
          type: "text",
          text: `Continue iteration ${nextIteration}/${loopConfig.maxIterations}. Output "${loopConfig.completionPromise}" when the task is complete.`,
        },
      ],
      permissionMode: "loop",
    };

    await queueFollowUpInternal({
      userId,
      threadId,
      threadChatId,
      messages: [message],
      source: "www",
      appendOrReplace: "append",
    });
  },
  { defaultErrorMessage: "Failed to approve loop iteration" },
);

/**
 * Stop a loop mode task
 */
export const stopLoop = userOnlyAction(
  async function stopLoop(
    userId: string,
    {
      threadId,
      threadChatId,
    }: {
      threadId: string;
      threadChatId: string;
    },
  ) {
    console.log("stopLoop", { threadId, threadChatId });
    const threadChat = await getThreadChat({
      db,
      threadId,
      userId,
      threadChatId,
    });
    if (!threadChat) {
      throw new UserFacingError("Task not found");
    }
    if (
      threadChat.permissionMode !== "loop" ||
      !threadChat.loopConfig?.isLoopActive
    ) {
      throw new UserFacingError("Task is not in loop mode");
    }

    // Update loopConfig: isLoopActive=false, awaitingApproval=false
    await updateThreadChat({
      db,
      userId,
      threadId,
      threadChatId,
      updates: {
        loopConfig: {
          ...threadChat.loopConfig,
          isLoopActive: false,
          awaitingApproval: false,
        },
      },
    });
  },
  { defaultErrorMessage: "Failed to stop loop" },
);
