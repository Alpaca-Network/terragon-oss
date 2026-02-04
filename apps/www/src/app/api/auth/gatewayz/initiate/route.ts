import { NextRequest, NextResponse } from "next/server";
import { publicAppUrl } from "@terragon/env/next-public";

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
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get("returnUrl") || "/dashboard";
  const mode = url.searchParams.get("mode") || "login"; // "login" or "connect"

  // Build our callback URL that GatewayZ will redirect to after auth
  const callbackUrl = new URL("/api/auth/gatewayz/callback", publicAppUrl());
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
