import { db } from "@/lib/db";
import { gatewayZUsageEvents } from "@terragon/shared/db/schema";

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
}) {
  // This function can be implemented later for usage dashboard
  // For now, we just track the raw events
  return { userId, startDate, endDate };
}
