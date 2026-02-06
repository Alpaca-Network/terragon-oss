"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { DBUserMessage } from "@terragon/shared";
import {
  followUpInternal,
  queueFollowUpInternal,
} from "@/server-lib/follow-up";
import { getAccessInfoForUser } from "@/lib/subscription";
import { SUBSCRIPTION_MESSAGES } from "@/lib/subscription-msgs";
import { UserFacingError } from "@/lib/server-actions";
import { db } from "@/lib/db";
import { updateThread } from "@terragon/shared/model/threads";

export type FollowUpArgs = {
  threadId: string;
  threadChatId: string;
  message: DBUserMessage;
};

export const followUp = userOnlyAction(
  async function followUp(
    userId: string,
    {
      threadId,
      threadChatId,
      message,
    }: {
      threadId: string;
      threadChatId: string;
      message: DBUserMessage;
    },
  ) {
    console.log("followUp", { threadId, threadChatId });
    const { tier } = await getAccessInfoForUser(userId);
    if (tier === "none") {
      throw new UserFacingError(SUBSCRIPTION_MESSAGES.FOLLOW_UP);
    }
    await followUpInternal({
      userId,
      threadId,
      threadChatId,
      message,
      source: "www",
    });
  },
  { defaultErrorMessage: "Failed to submit follow up" },
);

export type QueueFollowUpArgs = {
  threadId: string;
  threadChatId: string;
  messages: DBUserMessage[];
  autoMergePR?: boolean;
  autoFixFeedback?: boolean;
  // When true, updates autoFixQueuedAt timestamp to mark comments as "in progress"
  isAddressingFeedback?: boolean;
};

export const queueFollowUp = userOnlyAction(
  async function queueFollowUp(
    userId: string,
    {
      threadId,
      threadChatId,
      messages,
      autoMergePR,
      autoFixFeedback,
      isAddressingFeedback,
    }: {
      threadId: string;
      threadChatId: string;
      messages: DBUserMessage[];
      autoMergePR?: boolean;
      autoFixFeedback?: boolean;
      isAddressingFeedback?: boolean;
    },
  ) {
    console.log("queueFollowUp", { threadId, threadChatId });
    const { tier } = await getAccessInfoForUser(userId);
    if (tier === "none") {
      throw new UserFacingError(SUBSCRIPTION_MESSAGES.QUEUE_FOLLOW_UP);
    }

    // Update thread settings if autoMergePR, autoFixFeedback, or isAddressingFeedback are provided
    if (
      typeof autoMergePR === "boolean" ||
      typeof autoFixFeedback === "boolean" ||
      isAddressingFeedback
    ) {
      const updates: {
        autoMergePR?: boolean;
        autoFixFeedback?: boolean;
        autoFixQueuedAt?: Date;
      } = {};
      if (typeof autoMergePR === "boolean") {
        updates.autoMergePR = autoMergePR;
      }
      if (typeof autoFixFeedback === "boolean") {
        updates.autoFixFeedback = autoFixFeedback;
      }
      // Set autoFixQueuedAt when feedback is being addressed
      // This timestamp is used to determine if comments are "in progress"
      // (comments created before this timestamp are being addressed)
      if (isAddressingFeedback) {
        updates.autoFixQueuedAt = new Date();
      }
      await updateThread({
        db,
        userId,
        threadId,
        updates,
      });
    }

    await queueFollowUpInternal({
      userId,
      threadId,
      threadChatId,
      messages,
      source: "www",
      appendOrReplace: "replace",
    });
  },
  { defaultErrorMessage: "Failed to queue follow-up" },
);
