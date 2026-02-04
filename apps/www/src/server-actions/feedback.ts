"use server";

import { db } from "@/lib/db";
import { FeedbackType } from "@terragon/shared";
import { getUserOrNull, userOnlyAction } from "@/lib/auth-server";
import { getPostHogServer } from "@/lib/posthog-server";
import { sendFeedbackToSlack } from "@/utils/slack";
import { createFeedback } from "@terragon/shared/model/feedback";
import { UserFacingError } from "@/lib/server-actions";

export const submitFeedback = userOnlyAction(
  async function submitFeedback(
    userId: string,
    {
      type,
      message,
      currentPage,
      sessionReplayUrl,
    }: {
      type: FeedbackType;
      message: string;
      currentPage: string;
      sessionReplayUrl?: string | null;
    },
  ) {
    const user = await getUserOrNull();
    if (!user) {
      throw new UserFacingError("Unauthorized");
    }
    getPostHogServer().capture({
      distinctId: userId,
      event: "submit_feedback",
      properties: {
        type,
        message,
        currentPage,
        sessionReplayUrl,
      },
    });
    const newFeedback = await createFeedback({
      db,
      userId: user.id,
      type,
      message,
      currentPage,
      sessionReplayUrl,
    });
    // Send notification to Slack
    await sendFeedbackToSlack({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      type,
      message,
      currentPage,
      feedbackId: newFeedback.id,
      sessionReplayUrl,
    });
    return { success: true };
  },
  { defaultErrorMessage: "Failed to submit feedback" },
);
