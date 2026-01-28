import { env } from "@terragon/env/apps-www";
import { publicAppUrl } from "@terragon/env/next-public";

export async function internalPOST(path: string) {
  console.log(`internalPOST ${path}`);
  if (path.startsWith("/") || path.startsWith("http")) {
    throw new Error("Path must not start with / or http");
  }
  return fetch(`${publicAppUrl()}/api/internal/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Terragon-Secret": env.INTERNAL_SHARED_SECRET,
    },
  });
}

export interface AnthropicHealthStatus {
  down: boolean;
  checkedAt: number;
}

// In-memory cache for health status to avoid excessive API calls
let cachedStatus: AnthropicHealthStatus | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Check if Anthropic API is down by querying the centralized health service.
 * This allows the deployment to:
 * - Avoid hitting Anthropic if it's known to be down
 * - Centralize health logic in one tiny service
 * - Cache status externally
 *
 * The health service periodically calls Anthropic API and returns { down: boolean }
 *
 * @param skipCache - If true, bypass the local cache and fetch fresh status
 * @returns AnthropicHealthStatus with down: true if Anthropic is unavailable
 */
export async function isAnthropicAvailable(
  skipCache = false,
): Promise<AnthropicHealthStatus> {
  // Return cached status if valid and not skipping cache
  if (
    !skipCache &&
    cachedStatus &&
    Date.now() - cachedStatus.checkedAt < CACHE_TTL_MS
  ) {
    return cachedStatus;
  }

  try {
    const response = await fetch(env.IS_ANTHROPIC_DOWN_URL, {
      method: "GET",
      headers: {
        Authorization: env.IS_ANTHROPIC_DOWN_API_SECRET,
      },
      // Short timeout to avoid blocking requests for too long
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // If health service is unavailable, assume Anthropic is available
      // (fail open to avoid blocking users when health service is down)
      const status: AnthropicHealthStatus = {
        down: false,
        checkedAt: Date.now(),
      };
      cachedStatus = status;
      return status;
    }

    const data = (await response.json()) as {
      down: boolean;
    };

    const status: AnthropicHealthStatus = {
      down: data.down ?? false,
      checkedAt: Date.now(),
    };

    cachedStatus = status;
    return status;
  } catch (error) {
    console.error("Error checking Anthropic availability:", error);
    // Fail open: if we can't reach the health service, assume Anthropic is available
    const status: AnthropicHealthStatus = {
      down: false,
      checkedAt: Date.now(),
    };
    cachedStatus = status;
    return status;
  }
}

/**
 * Clear the cached Anthropic health status.
 * Useful for testing or when you want to force a fresh check.
 */
export function clearAnthropicHealthCache(): void {
  cachedStatus = null;
}

export async function isAnthropicDownPOST() {
  console.log(`isAnthropicDownPOST`);
  try {
    await fetch(`${env.IS_ANTHROPIC_DOWN_URL}/api/internal/report-issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-SECRET": env.IS_ANTHROPIC_DOWN_API_SECRET,
      },
    });
  } catch (error) {
    console.error("Error reporting issue:", error);
  }
}
