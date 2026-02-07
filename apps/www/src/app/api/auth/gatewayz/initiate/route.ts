import { NextRequest, NextResponse } from "next/server";
import { publicAppUrl } from "@terragon/env/next-public";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import { validateReturnUrl } from "@/lib/url-validation";

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
