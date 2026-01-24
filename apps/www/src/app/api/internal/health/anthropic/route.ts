import type { NextRequest } from "next/server";
import { env } from "@terragon/env/apps-www";

// In-memory cache for the health status
let cachedHealthStatus: { down: boolean; checkedAt: number } | null = null;
const HEALTH_CHECK_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Performs a lightweight health check against the Anthropic API.
 * Uses a minimal request to check if the API is responsive.
 */
async function checkAnthropicHealth(): Promise<boolean> {
  try {
    // Make a minimal request to Anthropic's API to check if it's responsive
    // Using the messages endpoint with a tiny request
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    // Consider it healthy if we get any response (even errors like rate limits)
    // A 5xx error or timeout indicates Anthropic is down
    if (response.status >= 500) {
      console.error(
        `Anthropic health check failed with status ${response.status}`,
      );
      return false; // Anthropic is down
    }

    return true; // Anthropic is up
  } catch (error) {
    console.error("Anthropic health check failed:", error);
    return false; // Anthropic is down (network error, timeout, etc.)
  }
}

/**
 * GET /api/internal/health/anthropic
 *
 * Returns the current Anthropic health status.
 * Validates requests using IS_ANTHROPIC_DOWN_API_SECRET in Authorization header.
 *
 * Response: { down: boolean }
 */
export async function GET(request: NextRequest) {
  // Validate the API secret
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== env.IS_ANTHROPIC_DOWN_API_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check if we have a recent cached status
  const now = Date.now();
  if (
    cachedHealthStatus &&
    now - cachedHealthStatus.checkedAt < HEALTH_CHECK_INTERVAL_MS
  ) {
    return Response.json({ down: cachedHealthStatus.down });
  }

  // Perform a fresh health check
  const isHealthy = await checkAnthropicHealth();

  cachedHealthStatus = {
    down: !isHealthy,
    checkedAt: now,
  };

  return Response.json({ down: !isHealthy });
}

/**
 * POST /api/internal/health/anthropic/check
 *
 * Triggers an immediate health check (bypasses cache).
 * Used by cron jobs to periodically update the status.
 */
export async function POST(request: NextRequest) {
  // Validate the API secret
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== env.IS_ANTHROPIC_DOWN_API_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Perform a fresh health check
  const isHealthy = await checkAnthropicHealth();

  cachedHealthStatus = {
    down: !isHealthy,
    checkedAt: Date.now(),
  };

  console.log(
    `Anthropic health check completed: ${isHealthy ? "healthy" : "down"}`,
  );

  return Response.json({ down: !isHealthy });
}
