import { NextRequest, NextResponse } from "next/server";
import { verifyGatewayZToken } from "@/lib/gatewayz-auth";
import { createSessionForGatewayZUser } from "@/lib/gatewayz-auth-server";

/**
 * Get the base URL for redirects.
 * Uses NEXT_PUBLIC_APP_URL or BETTER_AUTH_URL in production,
 * falls back to request.url in development.
 */
function getBaseUrl(request: NextRequest): string {
  // In production, use the configured app URL to avoid localhost issues behind proxies
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL;
  if (appUrl) {
    return appUrl;
  }
  // Fallback to request URL (works in development)
  return new URL(request.url).origin;
}

/**
 * GET /api/auth/gatewayz/callback
 *
 * Handle callback from GatewayZ login redirect.
 * Verifies the gwauth token, creates a session, and redirects to the target page.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const baseUrl = getBaseUrl(request);
    const token = url.searchParams.get("gwauth");
    const returnUrl = url.searchParams.get("returnUrl") || "/dashboard";
    const embed = url.searchParams.get("embed") === "true";

    if (!token) {
      console.error("GatewayZ callback: Missing token");
      return NextResponse.redirect(
        new URL(
          `/login?error=missing_token&returnUrl=${encodeURIComponent(returnUrl)}`,
          baseUrl,
        ),
      );
    }

    // Verify the GatewayZ token
    const gwSession = verifyGatewayZToken(token);
    if (!gwSession) {
      console.error("GatewayZ callback: Invalid or expired token");
      return NextResponse.redirect(
        new URL(
          `/login?error=invalid_token&returnUrl=${encodeURIComponent(returnUrl)}`,
          baseUrl,
        ),
      );
    }

    // Create or link user and create session
    const { sessionToken } = await createSessionForGatewayZUser(gwSession);

    console.log("GatewayZ callback: Session created successfully", {
      userId: gwSession.gwUserId,
      email: gwSession.email?.substring(0, 3) + "***",
      embed,
      returnUrl,
    });

    // Create redirect response first, then set cookies on it
    // Note: cookies() API doesn't work with NextResponse.redirect() - must set on response directly
    const redirectUrl = new URL(returnUrl, baseUrl);
    const response = NextResponse.redirect(redirectUrl);

    // When in embed mode (iframe context), we need sameSite: "none" with secure: true
    // for cookies to work cross-site. Otherwise use "lax" for regular auth flow.
    // We also add partitioned: true for CHIPS support in modern browsers.
    const sameSiteValue = embed ? "none" : "lax";

    // Set the session cookie (using the same cookie name as Better Auth)
    // Note: partitioned attribute enables CHIPS (Cookies Having Independent Partitioned State)
    // which allows third-party cookies to work even when third-party cookies are blocked
    response.cookies.set("better-auth.session_token", sessionToken, {
      httpOnly: true,
      secure: true, // Always secure in production (required for sameSite: none)
      sameSite: sameSiteValue,
      path: "/",
      maxAge: 60 * 60 * 24 * 60, // 60 days to match Better Auth session expiry
      ...(embed && { partitioned: true }), // CHIPS support for iframe context
    });

    // Also store GatewayZ token for API calls
    response.cookies.set("gw_auth_token", token, {
      httpOnly: true,
      secure: true, // Always secure in production (required for sameSite: none)
      sameSite: sameSiteValue,
      path: "/",
      maxAge: 60 * 60, // 1 hour to match GatewayZ token expiry
      ...(embed && { partitioned: true }), // CHIPS support for iframe context
    });

    // Set embed mode cookie if applicable
    if (embed) {
      response.cookies.set("gw_embed_mode", "true", {
        httpOnly: false,
        secure: true, // Always secure in production (required for sameSite: none)
        sameSite: "none", // Always none for embed mode cookie in iframe context
        path: "/",
        maxAge: 60 * 60, // 1 hour
        partitioned: true, // CHIPS support for iframe context
      });
    }

    return response;
  } catch (error) {
    console.error("GatewayZ callback error:", error);
    return NextResponse.redirect(
      new URL("/login?error=internal_error", getBaseUrl(request)),
    );
  }
}
