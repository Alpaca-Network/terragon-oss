import { implement } from "@orpc/server";
import { cliAPIContract } from "@terragon/cli-api-contract";
import { db } from "@/lib/db";
import {
  getThread,
  getThreadMinimal,
  getThreads,
  getThreadsAndPRsStats,
} from "@terragon/shared/model/threads";
import { getPrimaryThreadChat } from "@terragon/shared/utils/thread-utils";
import { newThreadInternal } from "@/server-lib/new-thread-internal";
import { DBUserMessage } from "@terragon/shared";
import type { AIAgent } from "@terragon/agent/types";
import { parseModelOrNull } from "@terragon/agent/utils";
import { isAppInstalledOnRepo } from "@terragon/shared/github-app";
import { getClaudeSessionJSONLOrNull } from "@/server-lib/claude-session";
import { checkCliTaskCreationRateLimit } from "@/lib/rate-limit";
import { ensureAgent } from "@terragon/agent/utils";
import { getUserIdOrNullFromDaemonToken } from "@/lib/auth-server";
import { combineThreadStatuses } from "@/agent/thread-status";
import { getUserCreditBalance } from "@terragon/shared/model/credits";
import { getUserUsageEventsAggregated } from "@terragon/shared/model/usage-events";
import { validateTimezone } from "@terragon/shared/utils/timezone";
import { subDays, set as setDateValues, format, addDays } from "date-fns";
import { tz } from "@date-fns/tz";

const os = implement(cliAPIContract)
  .$context<{
    headers: Headers;
    userId: string;
  }>()
  .use(async ({ context, next, errors }) => {
    const headers = (context?.headers || new Headers()) as Headers;
    const userId = await getUserIdOrNullFromDaemonToken({
      headers,
    });
    if (!userId) {
      throw errors.UNAUTHORIZED();
    }
    return next({
      context: {
        headers,
        userId,
      },
    });
  });

// Create procedures
const listThreads = os.threads.list.handler(async ({ input, context }) => {
  console.log("cli list threads", {
    userId: context.userId,
    repo: input.repo,
  });
  const threads = await getThreads({
    db,
    userId: context.userId,
    limit: 50,
    archived: false,
    githubRepoFullName: input.repo || undefined,
  });

  return threads.map((thread) => {
    return {
      id: thread.id,
      name: thread.name || null,
      branchName: thread.branchName,
      githubRepoFullName: thread.githubRepoFullName,
      githubPRNumber: thread.githubPRNumber,
      updatedAt: thread.updatedAt,
      isUnread: thread.isUnread,
      hasChanges: Boolean(thread.gitDiffStats?.files),
      status: combineThreadStatuses(
        thread.threadChats.map((chat) => chat.status),
      ),
    };
  });
});

const threadDetail = os.threads.detail.handler(
  async ({ input, context, errors }) => {
    console.log("cli thread detail", {
      threadId: input.threadId,
      userId: context.userId,
    });
    const { threadId } = input;
    const thread = await getThread({ db, threadId, userId: context.userId });
    if (!thread) {
      throw errors.NOT_FOUND({ message: "Thread not found" });
    }
    const threadChat = getPrimaryThreadChat(thread);
    const jsonlOrNull =
      threadChat.agent === "claudeCode"
        ? await getClaudeSessionJSONLOrNull({
            userId: context.userId,
            threadId,
            threadChatId: threadChat.id,
            session: null,
          })
        : null;
    return {
      threadId: thread.id,
      sessionId: threadChat.sessionId,
      name: thread.name,
      branchName: thread.branchName,
      baseBranchName: thread.repoBaseBranchName,
      githubRepoFullName: thread.githubRepoFullName,
      githubPRNumber: thread.githubPRNumber,
      jsonl: jsonlOrNull ?? null,
      agent: ensureAgent(threadChat.agent as AIAgent | null | undefined),
      hasChanges: Boolean(thread.gitDiffStats?.files),
    };
  },
);

const createThread = os.threads.create.handler(
  async ({ input, context, errors }) => {
    console.log("cli create thread", {
      userId: context.userId,
      githubRepoFullName: input.githubRepoFullName,
      repoBaseBranchName: input.repoBaseBranchName,
      createNewBranch: input.createNewBranch,
      mode: input.mode,
      model: input.model,
    });

    // Check rate limit before proceeding
    try {
      await checkCliTaskCreationRateLimit(context.userId);
    } catch (error) {
      throw errors.RATE_LIMIT_EXCEEDED({
        message: error instanceof Error ? error.message : "Rate limit exceeded",
      });
    }

    const {
      message,
      githubRepoFullName,
      repoBaseBranchName = "main",
      createNewBranch = true,
      mode,
      model,
    } = input;

    // Validate GitHub repository format
    const repoParts = githubRepoFullName.split("/");
    if (repoParts.length !== 2) {
      throw errors.INTERNAL_ERROR({
        message: `Invalid repository format: ${githubRepoFullName}. Expected format: owner/repo`,
      });
    }

    const [owner, repo] = repoParts;
    if (!owner || !repo) {
      throw errors.INTERNAL_ERROR({
        message: `Invalid repository format: ${githubRepoFullName}. Expected format: owner/repo`,
      });
    }

    // Check if GitHub App is installed on the repository
    try {
      const isInstalled = await isAppInstalledOnRepo(owner, repo);
      if (!isInstalled) {
        throw errors.INTERNAL_ERROR({
          message: `GitHub App is not installed on repository ${githubRepoFullName}. Please install the Terragon GitHub App on this repository first.`,
        });
      }
    } catch (error) {
      // If the error is already about the app not being installed, re-throw it
      if (error instanceof Error && error.message.includes("not installed")) {
        throw errors.INTERNAL_ERROR({
          message: error.message,
        });
      }
      // If the error is a timeout, preserve the timeout message for better diagnostics
      if (error instanceof Error && error.message.includes("timeout")) {
        throw errors.INTERNAL_ERROR({
          message: error.message,
        });
      }
      // Otherwise, the repository might not exist or there's a GitHub API issue
      throw errors.INTERNAL_ERROR({
        message: `Unable to access repository ${githubRepoFullName}. Please ensure the repository exists and you have access to it.`,
      });
    }

    // Exhaustive mapping from CLI mode -> permissionMode used by agent
    const toPermissionMode = (
      m: "plan" | "execute" | undefined,
    ): "allowAll" | "plan" => {
      switch (m) {
        case "plan":
          return "plan";
        case "execute":
        case undefined:
          return "allowAll";
        default: {
          const _exhaustive: never = m as never;
          return _exhaustive;
        }
      }
    };

    // Create the user message
    const userMessage: DBUserMessage = {
      type: "user",
      model: parseModelOrNull({ modelName: model }),
      parts: [{ type: "text", text: message }],
      timestamp: new Date().toISOString(),
      // Exhaustive switch ensures new modes are handled explicitly
      permissionMode: toPermissionMode(mode),
    };

    let baseBranchName = createNewBranch ? repoBaseBranchName : null;
    let headBranchName = createNewBranch ? null : repoBaseBranchName;
    try {
      const { threadId } = await newThreadInternal({
        userId: context.userId,
        message: userMessage,
        githubRepoFullName,
        baseBranchName,
        headBranchName,
        sourceType: "cli",
      });
      const thread = await getThreadMinimal({
        db,
        threadId,
        userId: context.userId,
      });
      if (!thread) {
        throw errors.INTERNAL_ERROR({ message: "Failed to create thread" });
      }
      return {
        threadId,
        branchName: thread.branchName,
      };
    } catch (error) {
      console.error("Error creating thread:", error);
      const msg =
        error instanceof Error ? error.message : "Failed to create thread";
      if (msg.includes("Task creation limit reached")) {
        throw errors.RATE_LIMIT_EXCEEDED({ message: msg });
      }
      throw errors.INTERNAL_ERROR({ message: msg });
    }
  },
);

// Auth helpers
const whoAmI = os.auth.whoami.handler(async ({ context }) => {
  return { userId: context.userId } as const;
});

// Exported for testing
export async function getInsightsData({
  userId,
  numDays,
  timezone,
}: {
  userId: string;
  numDays: number;
  timezone: string;
}) {
  const validatedTimezone = validateTimezone(timezone);
  const end = setDateValues(new Date(), {}, { in: tz(validatedTimezone) });
  const start = setDateValues(
    subDays(end, numDays - 1, { in: tz(validatedTimezone) }),
    { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 },
  );

  // Fetch all data in parallel
  const [creditBalance, usageAggregated, threadsAndPRsStats] =
    await Promise.all([
      getUserCreditBalance({ db, userId }),
      getUserUsageEventsAggregated({
        db,
        userId,
        startDate: start,
        endDate: end,
        timezone: validatedTimezone,
      }),
      getThreadsAndPRsStats({
        db,
        userId,
        startDate: start,
        endDate: end,
        timezone: validatedTimezone,
      }),
    ]);

  // Calculate token usage totals
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedInputTokens = 0;
  let totalCacheCreationInputTokens = 0;

  // Calculate cost breakdown by provider
  const costByProvider = {
    anthropic: 0,
    openai: 0,
    google: 0,
    openrouter: 0,
  };

  for (const event of usageAggregated) {
    const sku = event.eventType;
    const value = Number(event.value ?? 0);

    // Determine provider from event type
    if (sku.includes("anthropic")) {
      costByProvider.anthropic += value * 100; // Convert USD to cents
    } else if (sku.includes("openai")) {
      costByProvider.openai += value * 100;
    } else if (sku.includes("google")) {
      costByProvider.google += value * 100;
    } else if (sku.includes("openrouter")) {
      costByProvider.openrouter += value * 100;
    }
  }

  // Get token totals from usage events (need to fetch separately with token details)
  const { getUserUsageEvents } = await import(
    "@terragon/shared/model/usage-events"
  );
  const usageEvents = await getUserUsageEvents({
    db,
    userId,
    startDate: start,
    endDate: end,
  });

  for (const event of usageEvents) {
    totalInputTokens += event.inputTokens ?? 0;
    totalOutputTokens += event.outputTokens ?? 0;
    totalCachedInputTokens += event.cachedInputTokens ?? 0;
    totalCacheCreationInputTokens += event.cacheCreationInputTokens ?? 0;
  }

  // Build daily stats
  const dailyStatsMap = new Map<
    string,
    { date: string; threadsCreated: number; prsMerged: number }
  >();

  // Generate all dates in range
  // Use the timezone option to ensure date keys match the database data
  let currentDate = start;
  while (currentDate.getTime() <= end.getTime()) {
    const dateKey = format(currentDate, "yyyy-MM-dd", {
      in: tz(validatedTimezone),
    });
    if (!dailyStatsMap.has(dateKey)) {
      dailyStatsMap.set(dateKey, {
        date: dateKey,
        threadsCreated: 0,
        prsMerged: 0,
      });
    }
    currentDate = addDays(currentDate, 1, { in: tz(validatedTimezone) });
  }

  let totalThreadsCreated = 0;
  let totalPRsMerged = 0;

  for (const data of threadsAndPRsStats.threadsCreated) {
    const stats = dailyStatsMap.get(data.date);
    if (stats) {
      stats.threadsCreated = data.threadsCreated;
      totalThreadsCreated += data.threadsCreated;
    }
  }

  for (const data of threadsAndPRsStats.prsMerged) {
    const stats = dailyStatsMap.get(data.date);
    if (stats) {
      stats.prsMerged = data.prsMerged;
      totalPRsMerged += data.prsMerged;
    }
  }

  const dailyStats = Array.from(dailyStatsMap.values()).sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  const totalCost =
    costByProvider.anthropic +
    costByProvider.openai +
    costByProvider.google +
    costByProvider.openrouter;

  return {
    totalThreadsCreated,
    totalPRsMerged,
    tokenUsage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cachedInputTokens: totalCachedInputTokens,
      cacheCreationInputTokens: totalCacheCreationInputTokens,
    },
    costBreakdown: {
      anthropic: Math.round(costByProvider.anthropic),
      openai: Math.round(costByProvider.openai),
      google: Math.round(costByProvider.google),
      openrouter: Math.round(costByProvider.openrouter),
      total: Math.round(totalCost),
    },
    creditBalance: {
      totalCreditsCents: creditBalance.totalCreditsCents,
      totalUsageCents: creditBalance.totalUsageCents,
      balanceCents: creditBalance.balanceCents,
    },
    dailyStats,
  };
}

// Insights handler
const getInsights = os.insights.handler(async ({ input, context }) => {
  const userId = context.userId;
  const { numDays, timezone } = input;

  console.log("cli insights", {
    userId,
    numDays,
    timezone,
  });

  return getInsightsData({ userId, numDays, timezone });
});

// Create the router
export const cliRouter = os.router({
  threads: {
    list: listThreads,
    detail: threadDetail,
    create: createThread,
  },
  auth: {
    whoami: whoAmI,
  },
  insights: getInsights,
});
