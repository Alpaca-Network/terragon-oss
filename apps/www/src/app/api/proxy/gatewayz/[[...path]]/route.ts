import { NextRequest } from "next/server";
import { env } from "@terragon/env/apps-www";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logGatewayZUsage } from "../log-gatewayz-usage";
import { waitUntil } from "@vercel/functions";
import { validateProxyRequestModel } from "@/server-lib/proxy-model-validation";
import { checkProxyCredits } from "@/server-lib/proxy-credit-check";
import * as schema from "@terragon/shared/db/schema";
import { eq } from "drizzle-orm";

const GATEWAYZ_API_BASE = "https://api.gatewayz.ai/";
const DEFAULT_GATEWAYZ_PATH = "v1/chat/completions";

export const dynamic = "force-dynamic";

type HandlerArgs = { params: { path?: string[] } };
type AuthContext = {
  userId: string;
  gwTier: "free" | "pro" | "max";
  bodyBuffer?: ArrayBuffer | null;
};

type StreamEvent = {
  eventType: string | null;
  payload: unknown;
};

type StreamPayload = {
  type?: string;
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
  } | null;
  model?: string | null;
  id?: string | null;
};

type UsagePayloadFields = {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
};

type UsageKey = keyof UsagePayloadFields;

const STREAM_USAGE_KEYS: UsageKey[] = [
  "prompt_tokens",
  "completion_tokens",
  "total_tokens",
];

type UsageTotals = Record<UsageKey, number>;

function buildTargetUrl(
  request: NextRequest,
  pathSegments: string[] | undefined,
) {
  const pathname =
    pathSegments && pathSegments.length > 0
      ? pathSegments.join("/")
      : DEFAULT_GATEWAYZ_PATH;

  const targetUrl = new URL(pathname, GATEWAYZ_API_BASE);
  const search = request.nextUrl.search;
  if (search) {
    targetUrl.search = search;
  }

  return targetUrl;
}

function isChatCompletionsPath(pathname: string) {
  return (
    pathname === "/v1/chat/completions" ||
    pathname.startsWith("/v1/chat/completions/")
  );
}

function isJsonContentType(contentType: string | null) {
  return Boolean(contentType && contentType.includes("application/json"));
}

function isEventStreamContentType(contentType: string | null) {
  return Boolean(contentType && contentType.includes("text/event-stream"));
}

function findEventSeparator(buffer: string) {
  const lfIndex = buffer.indexOf("\n\n");
  const crlfIndex = buffer.indexOf("\r\n\r\n");
  if (lfIndex === -1 && crlfIndex === -1) {
    return null;
  }
  if (lfIndex !== -1 && (crlfIndex === -1 || lfIndex < crlfIndex)) {
    return { index: lfIndex, length: 2 } as const;
  }
  return { index: crlfIndex, length: 4 } as const;
}

function parseStreamEvent(rawEvent: string): StreamEvent | null {
  const lines = rawEvent.split(/\r?\n/);
  const dataLines: string[] = [];
  let eventType: string | null = null;

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      const data = line.slice(5).trimStart();
      // Skip [DONE] marker
      if (data === "[DONE]") {
        continue;
      }
      dataLines.push(data);
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const payloadText = dataLines.join("\n");

  try {
    const payload = JSON.parse(payloadText);
    return { eventType, payload };
  } catch (_error) {
    return null;
  }
}

function extractUsageFromStreamPayload(payload: StreamPayload): {
  usage: UsagePayloadFields | null | undefined;
  model?: string | null;
  requestId?: string | null;
} {
  const usage = payload.usage;
  const model = payload.model;
  const requestId = payload.id ?? null;

  return { usage, model, requestId };
}

/**
 * Determine the provider from the model name
 * Gatewayz routes to different upstream providers based on model prefix
 */
function getProviderFromModel(model: string | null | undefined): string {
  if (!model) return "unknown";

  const modelLower = model.toLowerCase();

  if (
    modelLower.includes("claude") ||
    modelLower.includes("opus") ||
    modelLower.includes("sonnet") ||
    modelLower.includes("haiku")
  ) {
    return "anthropic";
  }
  if (modelLower.includes("gpt") || modelLower.includes("codex")) {
    return "openai";
  }
  if (modelLower.includes("gemini")) {
    return "google";
  }
  if (modelLower.includes("glm")) {
    return "zai";
  }
  if (
    modelLower.includes("qwen") ||
    modelLower.includes("kimi") ||
    modelLower.includes("deepseek")
  ) {
    return "other";
  }

  return "unknown";
}

async function logUsageFromEventStream({
  stream,
  targetUrl,
  userId,
}: {
  stream: ReadableStream<Uint8Array>;
  targetUrl: URL;
  userId: string;
}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneReading = false;
  let knownModel: string | null | undefined;
  let knownRequestId: string | null | undefined;
  const aggregatedUsageTotals: UsageTotals = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  let sawUsageEvent = false;

  const processBuffer = async () => {
    let separator = findEventSeparator(buffer);
    while (separator) {
      const rawEvent = buffer.slice(0, separator.index);
      buffer = buffer.slice(separator.index + separator.length);
      if (!rawEvent.trim()) {
        separator = findEventSeparator(buffer);
        continue;
      }

      const parsed = parseStreamEvent(rawEvent);
      if (!parsed) {
        separator = findEventSeparator(buffer);
        continue;
      }

      const payload = parsed.payload as StreamPayload;
      const { usage, model, requestId } =
        extractUsageFromStreamPayload(payload);

      if (!knownModel && model) {
        knownModel = model;
      }
      if (!knownRequestId && requestId) {
        knownRequestId = requestId;
      }

      if (usage) {
        sawUsageEvent = true;
        const incomingUsage = usage as UsagePayloadFields;

        for (const key of STREAM_USAGE_KEYS) {
          const rawValue = incomingUsage[key];
          if (rawValue == null) {
            continue;
          }
          const parsedValue = Number(rawValue);
          if (!Number.isFinite(parsedValue)) {
            continue;
          }
          const value = Math.max(parsedValue, 0);
          if (value > aggregatedUsageTotals[key]) {
            aggregatedUsageTotals[key] = value;
          }
        }
      }

      separator = findEventSeparator(buffer);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        await processBuffer();
      }
      if (done) {
        buffer += decoder.decode();
        await processBuffer();
        doneReading = true;
        break;
      }
    }
  } catch (error) {
    console.error("Failed to log Gatewayz usage (event-stream)", error);
  } finally {
    if (!doneReading) {
      await reader.cancel().catch(() => undefined);
    } else {
      reader.releaseLock();
    }
  }

  if (sawUsageEvent) {
    const aggregatedUsageForLogging: UsagePayloadFields = {};
    let hasUsage = false;

    for (const key of STREAM_USAGE_KEYS) {
      const total = aggregatedUsageTotals[key];
      if (total > 0) {
        aggregatedUsageForLogging[key] = total;
        hasUsage = true;
      }
    }

    if (hasUsage) {
      try {
        await logGatewayZUsage({
          path: targetUrl.pathname,
          usage: aggregatedUsageForLogging,
          userId,
          model: knownModel ?? null,
          gwRequestId: knownRequestId ?? null,
          provider: getProviderFromModel(knownModel),
        });
      } catch (error) {
        console.error(
          "Failed to log Gatewayz usage (aggregated event-stream)",
          error,
        );
      }
    }
  }
}

function parseModelFromBodyBuffer(
  bodyBuffer?: ArrayBuffer | null,
): string | null {
  if (!bodyBuffer || bodyBuffer.byteLength === 0) {
    return null;
  }
  try {
    const bodyText = new TextDecoder().decode(bodyBuffer);
    if (!bodyText) {
      return null;
    }
    const parsed = JSON.parse(bodyText) as { model?: string | null };
    const model = parsed?.model;
    return typeof model === "string" ? model.trim() : null;
  } catch (_error) {
    return null;
  }
}

/**
 * Check if a model is a Code Router model
 * Code Router models follow the pattern: gatewayz/code-router[/mode]
 */
function isCodeRouterModel(model: string | null): boolean {
  return !!model && model.startsWith("gatewayz/code-router");
}

/**
 * Extract the Code Router mode from a model string
 * Returns 'balanced', 'price', or 'quality'
 */
function getCodeRouterMode(
  model: string | null,
): "balanced" | "price" | "quality" {
  if (!model || !isCodeRouterModel(model)) {
    return "balanced";
  }
  if (model === "gatewayz/code-router/price") {
    return "price";
  }
  if (model === "gatewayz/code-router/quality") {
    return "quality";
  }
  return "balanced";
}

/**
 * OpenCode models that free-tier users can access with credits.
 * These are specific models routed through OpenCode - not to be confused with
 * the broader model families (e.g., "claude-sonnet" here refers only to the
 * OpenCode-routed variant, not all Claude Sonnet models).
 *
 * This list should match the models defined in packages/agent/src/types.ts
 * under the "opencode" agent models (with appropriate prefix normalization).
 */
const OPENCODE_GATEWAYZ_MODELS = new Set([
  // Z.AI GLM models
  "glm-4.6",
  "glm-4.7",
  "glm-4.7-flash",
  "glm-4.7-lite",
  // Chinese/other models
  "kimi-k2",
  "grok-code",
  "qwen3-coder",
  // Google models (OpenCode variants)
  "gemini-2.5-pro",
  "gemini-3-pro",
  // OpenAI models (OpenCode variants)
  "gpt-5",
  "gpt-5-codex",
  // Anthropic models (OpenCode variants) - specific to opencode-ant/sonnet
  "sonnet",
]);

/**
 * Check if a model is an OpenCode model that free-tier users can access with credits.
 *
 * Note: The model string is expected to be the raw model from the request body
 * (e.g., "glm-4.7", "gpt-5", "sonnet"). Gatewayz uses OpenAI-compatible API format
 * where the model is always specified in the JSON request body for chat completions.
 */
function isOpencodeGatewayzModel(model: string): boolean {
  const normalized = model.toLowerCase().trim();

  // Check exact matches first (most OpenCode models)
  if (OPENCODE_GATEWAYZ_MODELS.has(normalized)) {
    return true;
  }

  // Check prefix matches for models with version suffixes
  // e.g., "glm-4.7-something" should still match
  for (const prefix of [
    "glm-4.6",
    "glm-4.7",
    "kimi-k2",
    "grok-code",
    "qwen3-coder",
    "gemini-2.5-pro",
    "gemini-3-pro",
    "gpt-5",
  ]) {
    if (normalized.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

async function proxyRequest(
  request: NextRequest,
  args: HandlerArgs,
  authContext: AuthContext,
) {
  const params = await args.params;
  const targetUrl = buildTargetUrl(request, params.path);

  const validation = await validateProxyRequestModel({
    request,
    provider: "gatewayz",
    bodyBuffer: authContext.bodyBuffer ?? undefined,
  });
  if (!validation.valid) {
    return new Response(validation.error, { status: 400 });
  }

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === "host" ||
      lowerKey === "content-length" ||
      lowerKey === "connection" ||
      lowerKey === "x-api-key" ||
      lowerKey === "authorization"
    ) {
      continue;
    }
    headers.set(key, value);
  }

  // Use Terragon's Gatewayz API key to make requests on behalf of users
  // The user's gwUserId is passed as a header for tracking
  headers.set("Authorization", `Bearer ${env.GATEWAYZ_API_KEY}`);
  headers.set("X-GatewayZ-User-Id", authContext.userId);
  headers.set("X-GatewayZ-Tier", authContext.gwTier);

  // Check if this is a Code Router request and set the appropriate headers
  const requestedModel = parseModelFromBodyBuffer(authContext.bodyBuffer);
  if (isCodeRouterModel(requestedModel)) {
    const codeRouterMode = getCodeRouterMode(requestedModel);
    headers.set("X-GatewayZ-Code-Router", "true");
    headers.set("X-GatewayZ-Code-Router-Mode", codeRouterMode);
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : (authContext.bodyBuffer ?? (await request.arrayBuffer()));

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  });

  let responseBody: BodyInit | null = response.body;
  if (isChatCompletionsPath(targetUrl.pathname)) {
    const contentType = response.headers.get("content-type");
    if (isEventStreamContentType(contentType) && response.body) {
      const [clientStream, loggingStream] = response.body.tee();
      responseBody = clientStream;
      void logUsageFromEventStream({
        stream: loggingStream,
        targetUrl,
        userId: authContext.userId,
      }).catch((error) => {
        console.error(
          "Failed to log Gatewayz usage (event-stream handler)",
          error,
        );
      });
    } else if (isJsonContentType(contentType)) {
      try {
        const buffer = await response.arrayBuffer();
        responseBody = buffer;
        const decoded = new TextDecoder().decode(buffer);
        const json = JSON.parse(decoded) as {
          usage?: StreamPayload["usage"];
          model?: string | null;
          id?: string | null;
        };
        if (json?.usage) {
          waitUntil(
            logGatewayZUsage({
              path: targetUrl.pathname,
              usage: json.usage,
              userId: authContext.userId,
              model: json.model ?? null,
              gwRequestId: json.id ?? null,
              provider: getProviderFromModel(json.model),
            }),
          );
        }
      } catch (error) {
        console.error("Failed to log Gatewayz usage (json)", error);
      }
    }
  }

  const responseHeaders = new Headers();
  for (const [key, value] of response.headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === "content-length" ||
      lowerKey === "connection" ||
      lowerKey === "transfer-encoding" ||
      lowerKey === "content-encoding"
    ) {
      continue;
    }
    responseHeaders.set(key, value);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    responseHeaders.set("Access-Control-Allow-Origin", origin);
    responseHeaders.set("Access-Control-Allow-Credentials", "true");
    responseHeaders.append("Vary", "Origin");
  } else {
    responseHeaders.set("Access-Control-Allow-Origin", "*");
  }

  return new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

function getDaemonTokenFromHeaders(headers: Headers) {
  const directToken = headers.get("X-Daemon-Token");
  if (directToken && directToken.trim() !== "") {
    return directToken.trim();
  }

  const authHeader = headers.get("authorization");
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^\s*Bearer\s+(.*)$/i);
  if (match && match[1]) {
    const token = match[1]!.trim();
    return token === "" ? null : token;
  }

  return null;
}

async function authorize(
  request: NextRequest,
  bodyBuffer?: ArrayBuffer | null,
): Promise<
  | { response: Response; userId?: undefined; gwTier?: undefined }
  | { response: null; userId: string; gwTier: "free" | "pro" | "max" }
> {
  const token = getDaemonTokenFromHeaders(request.headers);

  if (!token) {
    return { response: new Response("Unauthorized", { status: 401 }) };
  }

  try {
    const { valid, error, key } = await auth.api.verifyApiKey({
      body: { key: token },
    });

    const userId = key?.userId;

    if (error || !valid || !userId) {
      console.log("Unauthorized Gatewayz proxy request", { error, valid });
      return { response: new Response("Unauthorized", { status: 401 }) };
    }

    // Get user's Gatewayz tier from database
    const userRecord = await db
      .select({ gwTier: schema.user.gwTier })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    const gwTier = (userRecord[0]?.gwTier as "free" | "pro" | "max") || "free";

    // Check if user has an active Gatewayz subscription (pro or max)
    // Free-tier users can only access OpenCode models with credits
    if (gwTier === "free") {
      // Gatewayz uses OpenAI-compatible API format where the model is always
      // specified in the JSON request body for chat completions. This is the
      // only supported method for specifying the model - headers and query
      // params are not used. If no model is found in the body, the request
      // will fail at the validateProxyRequestModel step anyway.
      const requestedModel = parseModelFromBodyBuffer(bodyBuffer);

      if (requestedModel && isOpencodeGatewayzModel(requestedModel)) {
        // OpenCode model - check if user has credits or active subscription
        const creditCheck = await checkProxyCredits(userId, "OpenCode");
        if (!creditCheck.allowed) {
          return { response: creditCheck.response };
        }
        return { response: null, userId, gwTier };
      }

      // Non-OpenCode model or no model found - deny access for free tier
      console.log("Gatewayz proxy access denied: free tier user", {
        userId,
        gwTier,
        requestedModel: requestedModel ?? "(not found in body)",
      });
      return {
        response: new Response(
          "Gatewayz subscription required. Please upgrade to Pro or Max.",
          { status: 402 },
        ),
      };
    }

    return { response: null, userId, gwTier };
  } catch (err) {
    console.error("Failed to verify Gatewayz proxy request", err);
    return { response: new Response("Unauthorized", { status: 401 }) };
  }
}

async function handleWithAuth(
  request: NextRequest,
  args: HandlerArgs,
  handler: (
    request: NextRequest,
    args: HandlerArgs,
    context: AuthContext,
  ) => Promise<Response>,
) {
  const bodyBuffer =
    request.method === "GET" || request.method === "HEAD"
      ? null
      : await request.arrayBuffer();
  const authResult = await authorize(request, bodyBuffer);
  if (authResult.response) {
    return authResult.response;
  }
  return handler(request, args, {
    userId: authResult.userId,
    gwTier: authResult.gwTier,
    bodyBuffer,
  });
}

export async function GET(request: NextRequest, args: HandlerArgs) {
  return handleWithAuth(request, args, proxyRequest);
}

export async function POST(request: NextRequest, args: HandlerArgs) {
  return handleWithAuth(request, args, proxyRequest);
}

export async function PUT(request: NextRequest, args: HandlerArgs) {
  return handleWithAuth(request, args, proxyRequest);
}

export async function PATCH(request: NextRequest, args: HandlerArgs) {
  return handleWithAuth(request, args, proxyRequest);
}

export async function DELETE(request: NextRequest, args: HandlerArgs) {
  return handleWithAuth(request, args, proxyRequest);
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowOrigin = origin ?? "*";
  const allowHeaders =
    request.headers.get("access-control-request-headers") ??
    "authorization, content-type";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": allowHeaders,
    Vary: "Origin",
  };

  if (allowOrigin !== "*") {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}
