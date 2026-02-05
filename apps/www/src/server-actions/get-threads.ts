"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { ThreadInfo } from "@terragon/shared";
import { getThreads } from "@terragon/shared/model/threads";

export const getThreadsAction = userOnlyAction(
  async function getThreadsAction(
    userId: string,
    filters: {
      archived?: boolean;
      isBacklog?: boolean;
      automationId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<ThreadInfo[]> {
    const threads = await getThreads({
      db,
      userId,
      limit: filters.limit ?? 25,
      offset: filters.offset ?? 0,
      archived: filters.archived,
      isBacklog: filters.isBacklog,
      automationId: filters.automationId,
    });
    return threads;
  },
  { defaultErrorMessage: "Failed to get tasks" },
);
