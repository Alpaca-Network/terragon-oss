import { db } from "@/lib/db";
import { gatewayZUsageEvents } from "@terragon/shared/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

type UsagePayload = {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
};

/**
 * Log Gatewayz API usage to the database for tracking and reconciliation.
 * This data is used for:
 * 1. Displaying usage to users
 * 2. Cross-referencing with Gatewayz billing data
 * 3. Analytics and monitoring
 */
export async function logGatewayZUsage({
  path,
  usage,
  userId,
  model,
  gwRequestId,
  provider,
}: {
  path: string;
  usage: UsagePayload | null | undefined;
  userId?: string;
  model?: string | null;
  gwRequestId?: string | null;
  provider?: string;
}) {
  console.log("Gatewayz usage", {
    path,
    usage,
    provider,
    ...(model ? { model } : {}),
    ...(gwRequestId ? { gwRequestId } : {}),
  });

  if (!userId || !usage) {
    return;
  }

  const inputTokens = Math.max(Number(usage.prompt_tokens ?? 0), 0);
  const outputTokens = Math.max(Number(usage.completion_tokens ?? 0), 0);
  const totalTokens = Math.max(
    Number(usage.total_tokens ?? inputTokens + outputTokens),
    0,
  );

  if (totalTokens <= 0) {
    return;
  }

  try {
    await db.insert(gatewayZUsageEvents).values({
      userId,
      gwRequestId: gwRequestId ?? null,
      provider: provider ?? "unknown",
      model: model ?? "unknown",
      inputTokens,
      outputTokens,
      // Cost is calculated by Gatewayz, we just track tokens
      // Cost reconciliation happens during sync with Gatewayz API
      costUsd: null,
    });
  } catch (error) {
    console.error("Failed to log Gatewayz usage to database", error);
  }
}

export type GatewayZUsageSummary = {
  userId: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  requestCount: number;
  byProvider: Record<
    string,
    { inputTokens: number; outputTokens: number; requestCount: number }
  >;
  byModel: Record<
    string,
    { inputTokens: number; outputTokens: number; requestCount: number }
  >;
};

/**
 * Get usage summary for a user within a time range
 */
export async function getGatewayZUsageSummary({
  userId,
  startDate,
  endDate,
}: {
  userId: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<GatewayZUsageSummary> {
  const conditions = [eq(gatewayZUsageEvents.userId, userId)];

  if (startDate) {
    conditions.push(gte(gatewayZUsageEvents.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(gatewayZUsageEvents.createdAt, endDate));
  }

  // Get aggregated totals
  const [totals] = await db
    .select({
      totalInputTokens: sql<number>`COALESCE(SUM(${gatewayZUsageEvents.inputTokens}), 0)::int`,
      totalOutputTokens: sql<number>`COALESCE(SUM(${gatewayZUsageEvents.outputTokens}), 0)::int`,
      requestCount: sql<number>`COUNT(*)::int`,
    })
    .from(gatewayZUsageEvents)
    .where(and(...conditions));

  // Get breakdown by provider
  const byProviderRows = await db
    .select({
      provider: gatewayZUsageEvents.provider,
      inputTokens: sql<number>`COALESCE(SUM(${gatewayZUsageEvents.inputTokens}), 0)::int`,
      outputTokens: sql<number>`COALESCE(SUM(${gatewayZUsageEvents.outputTokens}), 0)::int`,
      requestCount: sql<number>`COUNT(*)::int`,
    })
    .from(gatewayZUsageEvents)
    .where(and(...conditions))
    .groupBy(gatewayZUsageEvents.provider);

  // Get breakdown by model
  const byModelRows = await db
    .select({
      model: gatewayZUsageEvents.model,
      inputTokens: sql<number>`COALESCE(SUM(${gatewayZUsageEvents.inputTokens}), 0)::int`,
      outputTokens: sql<number>`COALESCE(SUM(${gatewayZUsageEvents.outputTokens}), 0)::int`,
      requestCount: sql<number>`COUNT(*)::int`,
    })
    .from(gatewayZUsageEvents)
    .where(and(...conditions))
    .groupBy(gatewayZUsageEvents.model);

  const byProvider: GatewayZUsageSummary["byProvider"] = {};
  for (const row of byProviderRows) {
    byProvider[row.provider] = {
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      requestCount: row.requestCount,
    };
  }

  const byModel: GatewayZUsageSummary["byModel"] = {};
  for (const row of byModelRows) {
    byModel[row.model] = {
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      requestCount: row.requestCount,
    };
  }

  return {
    userId,
    startDate,
    endDate,
    totalInputTokens: totals?.totalInputTokens ?? 0,
    totalOutputTokens: totals?.totalOutputTokens ?? 0,
    totalTokens:
      (totals?.totalInputTokens ?? 0) + (totals?.totalOutputTokens ?? 0),
    requestCount: totals?.requestCount ?? 0,
    byProvider,
    byModel,
  };
}
