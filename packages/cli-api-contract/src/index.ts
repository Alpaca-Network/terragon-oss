import { oc as ocBase } from "@orpc/contract";
import { AIAgentSchema, AIModelExternalSchema } from "@terragon/agent/types";
import * as z from "zod/v4";

const oc = ocBase.errors({
  UNAUTHORIZED: {
    message: "Unauthorized",
  },
  NOT_FOUND: {
    message: "Not found",
  },
  INTERNAL_ERROR: {
    message: "Internal server error",
  },
  RATE_LIMIT_EXCEEDED: {
    message: "Rate limit exceeded",
  },
});

// Define individual contracts
const listThreadsContract = oc
  .input(
    z.object({
      repo: z.string().optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string().nullable(),
        branchName: z.string().nullable(),
        githubRepoFullName: z.string().nullable(),
        githubPRNumber: z.number().nullable(),
        status: z.string(),
        updatedAt: z.date(),
        isUnread: z.boolean(),
        hasChanges: z.boolean().optional(),
      }),
    ),
  );

const threadDetailContract = oc
  .input(
    z.object({
      threadId: z.string(),
    }),
  )
  .output(
    z.object({
      threadId: z.string(),
      sessionId: z.string().nullable(),
      name: z.string().nullable(),
      branchName: z.string().nullable(),
      baseBranchName: z.string().nullable(),
      githubRepoFullName: z.string().nullable(),
      githubPRNumber: z.number().nullable(),
      jsonl: z.array(z.any()).nullable(),
      agent: AIAgentSchema,
      hasChanges: z.boolean().optional(),
    }),
  );

const createThreadContract = oc
  .input(
    z.object({
      message: z.string(),
      githubRepoFullName: z.string(),
      repoBaseBranchName: z.string().optional(),
      createNewBranch: z.boolean().optional(),
      // Optional task mode from CLI
      mode: z.enum(["plan", "execute"]).optional(),
      // Optional model selection from CLI
      model: AIModelExternalSchema.optional(),
    }),
  )
  .output(
    z.object({
      threadId: z.string(),
      branchName: z.string().nullable(),
    }),
  );

// Token usage breakdown by provider
const tokenUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  cachedInputTokens: z.number(),
  cacheCreationInputTokens: z.number(),
});

// Cost breakdown by provider
const costBreakdownSchema = z.object({
  anthropic: z.number(), // in cents
  openai: z.number(),
  google: z.number(),
  openrouter: z.number(),
  total: z.number(),
});

// Credit balance info
const creditBalanceSchema = z.object({
  totalCreditsCents: z.number(),
  totalUsageCents: z.number(),
  balanceCents: z.number(),
});

// Daily stats breakdown
const dailyStatsSchema = z.object({
  date: z.string(),
  threadsCreated: z.number(),
  prsMerged: z.number(),
});

const insightsContract = oc
  .input(
    z.object({
      numDays: z.number().min(1).max(30).default(7),
      timezone: z.string().default("UTC"),
    }),
  )
  .output(
    z.object({
      // Activity summary
      totalThreadsCreated: z.number(),
      totalPRsMerged: z.number(),
      // Token usage
      tokenUsage: tokenUsageSchema,
      // Cost breakdown by provider
      costBreakdown: costBreakdownSchema,
      // Credit balance
      creditBalance: creditBalanceSchema,
      // Daily breakdown
      dailyStats: z.array(dailyStatsSchema),
    }),
  );

// Define the CLI API contract router
export const cliAPIContract = {
  threads: {
    list: listThreadsContract,
    detail: threadDetailContract,
    create: createThreadContract,
  },
  auth: {
    // Minimal endpoint for VSCode to discover the current user id
    whoami: oc.input(z.void()).output(z.object({ userId: z.string() })),
  },
  insights: insightsContract,
};
