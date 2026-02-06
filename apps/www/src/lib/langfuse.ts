import { Langfuse } from "langfuse";
import { env } from "@terragon/env/apps-www";
import { db } from "@/lib/db";
import { getFeatureFlagGlobalOverride } from "@terragon/shared/model/feature-flags";

let langfuseInstance: Langfuse | null = null;
let langfuseEnabledCache: boolean | null = null;
let langfuseEnabledCacheTime: number = 0;
const CACHE_TTL_MS = 60_000; // Cache feature flag check for 1 minute

/**
 * Check if Langfuse is configured (has API keys)
 */
export function isLangfuseConfigured(): boolean {
  return Boolean(env.LANGFUSE_SECRET_KEY && env.LANGFUSE_PUBLIC_KEY);
}

/**
 * Check if Langfuse is enabled via feature flag (async, with caching)
 */
async function checkLangfuseFeatureFlag(): Promise<boolean> {
  const now = Date.now();

  // Return cached value if still valid
  if (
    langfuseEnabledCache !== null &&
    now - langfuseEnabledCacheTime < CACHE_TTL_MS
  ) {
    return langfuseEnabledCache;
  }

  try {
    const enabled = await getFeatureFlagGlobalOverride({
      db,
      name: "langfuseTracing",
    });
    langfuseEnabledCache = enabled;
    langfuseEnabledCacheTime = now;
    return enabled;
  } catch (error) {
    console.error("Failed to check langfuseTracing feature flag:", error);
    // Cache as disabled so we don't hammer the DB on repeated failures
    langfuseEnabledCache = false;
    langfuseEnabledCacheTime = now;
    return false;
  }
}

/**
 * Check if Langfuse is configured (synchronous check for API keys).
 * Note: This does NOT check the feature flag - use traceGeneration/traceSpan
 * which perform the async feature flag check internally.
 */
export function isLangfuseEnabled(): boolean {
  return isLangfuseConfigured();
}

/**
 * Get the Langfuse client singleton instance.
 * Returns null if Langfuse is not configured.
 */
export function getLangfuse(): Langfuse | null {
  if (!isLangfuseEnabled()) {
    return null;
  }

  if (!langfuseInstance) {
    langfuseInstance = new Langfuse({
      secretKey: env.LANGFUSE_SECRET_KEY,
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      baseUrl: env.LANGFUSE_HOST || "https://cloud.langfuse.com",
      // Flush after each event to ensure prompt delivery in serverless environments
      flushAt: 1,
      flushInterval: 1000,
    });
  }

  return langfuseInstance;
}

/**
 * Shutdown Langfuse gracefully - flushes any pending events.
 * Call this on process shutdown or when you need to ensure all events are sent.
 */
export async function shutdownLangfuse(): Promise<void> {
  if (langfuseInstance) {
    await langfuseInstance.shutdownAsync();
    langfuseInstance = null;
  }
}

export type LangfuseGenerationParams = {
  // Identifiers
  traceId?: string;
  name: string;
  // User and session context
  userId?: string;
  sessionId?: string;
  // Model details
  model?: string | null;
  provider?: string;
  // Request/response
  input?: unknown;
  output?: unknown;
  // Usage metrics
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    // Anthropic-specific
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
  // Cost (if known)
  totalCost?: number;
  // Additional metadata
  metadata?: Record<string, unknown>;
  // Timing
  startTime?: Date;
  endTime?: Date;
  // Status
  statusMessage?: string;
  level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
};

/**
 * Create a generation trace in Langfuse for an LLM call.
 * This is used to track individual LLM API calls for observability.
 * Checks both configuration and feature flag before tracing.
 *
 * Returns a promise that resolves when tracing is complete.
 * In serverless environments, pass this promise to `waitUntil()` to ensure
 * the tracing completes before the function terminates.
 */
export async function traceGeneration(
  params: LangfuseGenerationParams,
): Promise<void> {
  // Quick sync check - skip if not configured
  if (!isLangfuseConfigured()) {
    return;
  }

  try {
    // Check feature flag (with caching)
    const isEnabled = await checkLangfuseFeatureFlag();
    if (!isEnabled) {
      return;
    }

    const langfuse = getLangfuse();
    if (!langfuse) {
      return;
    }

    const trace = langfuse.trace({
      id: params.traceId,
      name: params.name,
      userId: params.userId,
      sessionId: params.sessionId,
      metadata: params.metadata,
    });

    trace.generation({
      name: params.name,
      model: params.model ?? undefined,
      input: params.input,
      output: params.output,
      usage: params.usage
        ? {
            promptTokens: params.usage.promptTokens,
            completionTokens: params.usage.completionTokens,
            totalTokens: params.usage.totalTokens,
          }
        : undefined,
      costDetails:
        params.totalCost !== undefined
          ? { total: params.totalCost }
          : undefined,
      metadata: {
        provider: params.provider,
        cacheCreationInputTokens: params.usage?.cacheCreationInputTokens,
        cacheReadInputTokens: params.usage?.cacheReadInputTokens,
        ...params.metadata,
      },
      startTime: params.startTime,
      endTime: params.endTime,
      statusMessage: params.statusMessage,
      level: params.level,
    });

    // Flush events to ensure delivery before promise resolves (critical for serverless)
    await langfuse.flushAsync();
  } catch (error) {
    // Silently fail - observability should not break the main flow
    console.error("Failed to trace generation in Langfuse:", error);
  }
}

export type LangfuseSpanParams = {
  traceId?: string;
  name: string;
  userId?: string;
  sessionId?: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  startTime?: Date;
  endTime?: Date;
  statusMessage?: string;
  level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
};

/**
 * Create a span trace in Langfuse for tracking operations.
 * Checks both configuration and feature flag before tracing.
 *
 * Returns a promise that resolves when tracing is complete.
 * In serverless environments, pass this promise to `waitUntil()` to ensure
 * the tracing completes before the function terminates.
 */
export async function traceSpan(params: LangfuseSpanParams): Promise<void> {
  // Quick sync check - skip if not configured
  if (!isLangfuseConfigured()) {
    return;
  }

  try {
    // Check feature flag (with caching)
    const isEnabled = await checkLangfuseFeatureFlag();
    if (!isEnabled) {
      return;
    }

    const langfuse = getLangfuse();
    if (!langfuse) {
      return;
    }

    const trace = langfuse.trace({
      id: params.traceId,
      name: params.name,
      userId: params.userId,
      sessionId: params.sessionId,
      metadata: params.metadata,
    });

    trace.span({
      name: params.name,
      input: params.input,
      output: params.output,
      metadata: params.metadata,
      startTime: params.startTime,
      endTime: params.endTime,
      statusMessage: params.statusMessage,
      level: params.level,
    });

    // Flush events to ensure delivery before promise resolves (critical for serverless)
    await langfuse.flushAsync();
  } catch (error) {
    console.error("Failed to trace span in Langfuse:", error);
  }
}
