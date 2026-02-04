import { NextRequest, NextResponse } from "next/server";
import { publicAppUrl } from "@terragon/env/next-public";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

/**
 * Rate limiter for Gatewayz auth initiation
 * Allows 10 requests per minute per IP to prevent abuse
 */
const authInitiateRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1m"),
  prefix: "@upstash/ratelimit:gatewayz-auth-initiate",
});

/**
 * Get the GatewayZ URL from environment or default to production
 */
function getGatewayZUrl(): string {
  return process.env.NEXT_PUBLIC_GATEWAYZ_URL ?? "https://gatewayz.ai";
}

/**
 * Validate that the returnUrl is a safe relative path or same-origin URL.
 * Prevents open redirect vulnerabilities.
 */
function validateReturnUrl(returnUrl: string, baseUrl: string): string {
  // Default to dashboard if empty
  if (!returnUrl) {
    return "/dashboard";
  }

  // Allow relative paths starting with /
  if (returnUrl.startsWith("/") && !returnUrl.startsWith("//")) {
    return returnUrl;
  }

  // Check if it's a same-origin absolute URL
  try {
    const parsedUrl = new URL(returnUrl);
    const parsedBase = new URL(baseUrl);
    if (parsedUrl.origin === parsedBase.origin) {
      return parsedUrl.pathname + parsedUrl.search;
    }
  } catch {
    // Invalid URL, fall through to default
  }

  // Default to dashboard for invalid or external URLs
  return "/dashboard";
}

/**
 * GET /api/auth/gatewayz/initiate
 *
 * Initiates the GatewayZ OAuth-style authentication flow.
 * Redirects the user to GatewayZ to sign in, which will then redirect back
 * to our callback URL with an auth token.
 */
export async function GET(request: NextRequest) {
  // Rate limiting by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const rateLimitResult = await authInitiateRateLimit.limit(ip);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const url = new URL(request.url);
  const baseUrl = publicAppUrl();
  const rawReturnUrl = url.searchParams.get("returnUrl") || "/dashboard";
  const returnUrl = validateReturnUrl(rawReturnUrl, baseUrl);
  const mode = url.searchParams.get("mode") || "login"; // "login" or "connect"

  // Build our callback URL that GatewayZ will redirect to after auth
  const callbackUrl = new URL("/api/auth/gatewayz/callback", baseUrl);
  callbackUrl.searchParams.set("returnUrl", returnUrl);
  if (mode === "connect") {
    callbackUrl.searchParams.set("mode", "connect");
  }

  // Build the GatewayZ auth URL
  // GatewayZ expects a redirect_uri parameter and will append ?gwauth=<token> to it
  const gatewayzAuthUrl = new URL("/auth/terragon", getGatewayZUrl());
  gatewayzAuthUrl.searchParams.set("redirect_uri", callbackUrl.toString());

  return NextResponse.redirect(gatewayzAuthUrl.toString());
}
