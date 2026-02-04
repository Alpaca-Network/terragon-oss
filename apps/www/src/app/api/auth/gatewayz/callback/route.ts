import { NextRequest, NextResponse } from "next/server";
import { verifyGatewayZToken } from "@/lib/gatewayz-auth";
import {
  createSessionForGatewayZUser,
  connectGatewayZToExistingUser,
} from "@/lib/gatewayz-auth-server";
import { getUserIdOrNull } from "@/lib/auth-server";

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
 * Generate an HTML page for embed mode authentication.
 *
 * In embed mode (iframe), third-party cookies are blocked by modern browsers.
 * Instead of relying on cookies, we:
 * 1. Send the session token to the parent window via postMessage
 * 2. Store the token in sessionStorage for the iframe's use
 * 3. Redirect to the dashboard
 *
 * The parent window (GatewayZ) will receive the session token and can store it
 * to pass along with subsequent requests if needed.
 */
function generateEmbedAuthPage(
  redirectUrl: string,
  sessionToken: string,
  gwAuthToken: string,
): string {
  // Encode tokens for safe embedding in JavaScript
  const safeSessionToken = sessionToken.replace(/'/g, "\\'");
  const safeGwAuthToken = gwAuthToken.replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating...</title>
</head>
<body>
  <p>Authenticating, please wait...</p>
  <script>
    (function() {
      try {
        // Store session token in sessionStorage for iframe's own use
        sessionStorage.setItem('terragon_session_token', '${safeSessionToken}');
        sessionStorage.setItem('gw_auth_token', '${safeGwAuthToken}');
        sessionStorage.setItem('gw_embed_mode', 'true');

        // Notify parent window that auth is complete
        // Parent can use this to track auth state
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'TERRAGON_AUTH_COMPLETE',
            success: true
          }, '*');
        }
      } catch (e) {
        console.error('Failed to store session:', e);
      }

      // Navigate to dashboard
      window.location.href = '${redirectUrl}';
    })();
  </script>
</body>
</html>`;
}

/**
 * GET /api/auth/gatewayz/callback
 *
 * Handle callback from GatewayZ login/connect redirect.
 * Verifies the gwauth token and either:
 * - Creates a new session (login mode)
 * - Links GatewayZ to existing user (connect mode)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const baseUrl = getBaseUrl(request);
    const token = url.searchParams.get("gwauth");
    const returnUrl = url.searchParams.get("returnUrl") || "/dashboard";
    const embed = url.searchParams.get("embed") === "true";
    const mode = url.searchParams.get("mode") || "login"; // "login" or "connect"

    if (!token) {
      console.error("GatewayZ callback: Missing token");
      const errorRedirect =
        mode === "connect"
          ? `/settings/agent?error=missing_token`
          : `/login?error=missing_token&returnUrl=${encodeURIComponent(returnUrl)}`;
      return NextResponse.redirect(new URL(errorRedirect, baseUrl));
    }

    // Verify the GatewayZ token
    const gwSession = verifyGatewayZToken(token);
    if (!gwSession) {
      console.error("GatewayZ callback: Invalid or expired token");
      const errorRedirect =
        mode === "connect"
          ? `/settings/agent?error=invalid_token`
          : `/login?error=invalid_token&returnUrl=${encodeURIComponent(returnUrl)}`;
      return NextResponse.redirect(new URL(errorRedirect, baseUrl));
    }

    let sessionToken: string;

    // Handle connect mode - link GatewayZ to existing user
    if (mode === "connect") {
      const existingUserId = await getUserIdOrNull();
      if (!existingUserId) {
        // User not logged in, redirect to login
        // Build the nested URL properly to avoid double encoding
        const initiateUrl = `/api/auth/gatewayz/initiate?mode=connect&returnUrl=${encodeURIComponent(returnUrl)}`;
        return NextResponse.redirect(
          new URL(
            `/login?returnUrl=${encodeURIComponent(initiateUrl)}`,
            baseUrl,
          ),
        );
      }

      await connectGatewayZToExistingUser(existingUserId, gwSession);
      console.log("GatewayZ callback: Connected to existing user", {
        userId: existingUserId,
        gwUserId: gwSession.gwUserId,
        tier: gwSession.tier,
      });

      // Redirect back to settings with success message
      return NextResponse.redirect(
        new URL(`${returnUrl}?gatewayz_connected=true`, baseUrl),
      );
    }

    // Handle login mode - create or link user and create session
    const result = await createSessionForGatewayZUser(gwSession);
    sessionToken = result.sessionToken;

    console.log("GatewayZ callback: Session created successfully", {
      userId: gwSession.gwUserId,
      email: gwSession.email?.substring(0, 3) + "***",
      embed,
      returnUrl,
    });

    const redirectUrl = new URL(returnUrl, baseUrl).toString();

    // Build cookie strings for Set-Cookie headers
    // In embed mode (iframe context), we need sameSite: "none" with secure: true
    // for cookies to work cross-site. Otherwise use "lax" for regular auth flow.
    const cookieOptions = embed
      ? `; Path=/; Secure; SameSite=None; Partitioned`
      : `; Path=/; Secure; SameSite=Lax`;

    const sessionCookieMaxAge = 60 * 60 * 24 * 60; // 60 days
    const gwTokenMaxAge = 60 * 60; // 1 hour

    const cookies = [
      `better-auth.session_token=${sessionToken}; Max-Age=${sessionCookieMaxAge}; HttpOnly${cookieOptions}`,
      `gw_auth_token=${token}; Max-Age=${gwTokenMaxAge}; HttpOnly${cookieOptions}`,
    ];

    if (embed) {
      cookies.push(
        `gw_embed_mode=true; Max-Age=${gwTokenMaxAge}${cookieOptions}`,
      );
    }

    // In embed mode, return an HTML page that stores the session in sessionStorage
    // and notifies the parent. This avoids third-party cookie blocking issues.
    if (embed) {
      const html = generateEmbedAuthPage(redirectUrl, sessionToken, token);
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          // Still try to set cookies (may work in some browsers), but don't rely on them
          "Set-Cookie": cookies.join(", "),
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // For non-embed mode, use standard redirect with cookies
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set("better-auth.session_token", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookieMaxAge,
    });

    response.cookies.set("gw_auth_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: gwTokenMaxAge,
    });

    return response;
  } catch (error) {
    console.error("GatewayZ callback error:", error);
    return NextResponse.redirect(
      new URL("/login?error=internal_error", getBaseUrl(request)),
    );
  }
}
