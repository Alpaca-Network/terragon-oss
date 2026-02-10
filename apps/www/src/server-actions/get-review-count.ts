"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { getInReviewThreadCount } from "@terragon/shared/model/threads";

/**
 * Get the count of threads in the "in_review" Kanban column for the current user.
 * This is used by the dynamic favicon badge to show the count without loading all threads.
 */
export const getReviewCountAction = userOnlyAction(
  async function getReviewCountAction(userId: string): Promise<number> {
    return await getInReviewThreadCount({ db, userId });
  },
  { defaultErrorMessage: "Failed to get review count" },
);
