"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { updateThread } from "@terragon/shared/model/threads";
import { getPostHogServer } from "@/lib/posthog-server";

export const sendToBacklog = userOnlyAction(
  async function sendToBacklog(userId: string, threadId: string) {
    console.log("sendToBacklog", threadId);
    getPostHogServer().capture({
      distinctId: userId,
      event: "send_to_backlog",
      properties: {
        threadId,
      },
    });
    await updateThread({
      db,
      userId,
      threadId,
      updates: {
        isBacklog: true,
        updatedAt: new Date(),
      },
    });
  },
  { defaultErrorMessage: "Failed to send task to backlog" },
);

export const removeFromBacklog = userOnlyAction(
  async function removeFromBacklog(userId: string, threadId: string) {
    console.log("removeFromBacklog", threadId);
    getPostHogServer().capture({
      distinctId: userId,
      event: "remove_from_backlog",
      properties: {
        threadId,
      },
    });
    await updateThread({
      db,
      userId,
      threadId,
      updates: {
        isBacklog: false,
        updatedAt: new Date(),
      },
    });
  },
  { defaultErrorMessage: "Failed to remove task from backlog" },
);
