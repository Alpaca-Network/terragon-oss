import { NextRequest, NextResponse } from "next/server";
import { verifyGatewayZToken } from "@/lib/gatewayz-auth";
import {
  createSessionForGatewayZUser,
  connectGatewayZToExistingUser,
} from "@/lib/gatewayz-auth-server";
import { getUserIdOrNull } from "@/lib/auth-server";
import { validateReturnUrl } from "@/lib/url-validation";

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
 * Default allowed origins for postMessage in embed mode.
 * These are the trusted GatewayZ domains that can receive auth completion messages.
 */
const DEFAULT_ALLOWED_EMBED_ORIGINS = [
  "https://gatewayz.ai",
  "https://www.gatewayz.ai",
  "https://beta.gatewayz.ai",
  "https://inbox.gatewayz.ai",
];

/**
 * Get the allowed origins for postMessage in embed mode.
 * Uses GATEWAYZ_ALLOWED_ORIGINS env var if set (comma-separated),
 * otherwise falls back to defaults.
 *
 * Security: Filters out empty strings (from extra commas like "a,,b" or empty env var)
 * and invalid URLs to prevent postMessage from failing silently or being sent to
 * unintended targets. Falls back to defaults if env var produces no valid origins,
 * ensuring auth flow never breaks due to misconfiguration.
 */
function getAllowedEmbedOrigins(): string[] {
  const envOrigins = process.env.GATEWAYZ_ALLOWED_ORIGINS;
  if (envOrigins) {
    const origins = envOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0 && isValidHttpsOrigin(origin));
    // Fall back to defaults if env var produces no valid origins (empty string, only commas, etc.)
    return origins.length > 0 ? origins : DEFAULT_ALLOWED_EMBED_ORIGINS;
  }
  return DEFAULT_ALLOWED_EMBED_ORIGINS;
}

/**
 * Escape a string for safe embedding in a JavaScript string literal.
 * Handles backslashes, quotes, newlines, Unicode line terminators, and HTML special characters.
 */
function escapeForJsString(str: string): string {
  return str
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\n/g, "\\n") // Escape newlines
    .replace(/\r/g, "\\r") // Escape carriage returns
    .replace(/\t/g, "\\t") // Escape tabs
    .replace(/\u2028/g, "\\u2028") // Escape Unicode line separator
    .replace(/\u2029/g, "\\u2029") // Escape Unicode paragraph separator
    .replace(/</g, "\\x3c") // Escape < to prevent </script> injection
    .replace(/>/g, "\\x3e"); // Escape > for consistency
}

/**
 * Validate that a string is a valid HTTPS origin URL.
 */
function isValidHttpsOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.origin === origin;
  } catch {
    return false;
  }
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
 *
 * Security: postMessage is sent only to trusted GatewayZ origins to prevent
 * information disclosure to malicious iframe parents.
 */
function generateEmbedAuthPage(
  redirectUrl: string,
  sessionToken: string,
  gwAuthToken: string,
): string {
  // Encode all dynamic values for safe embedding in JavaScript string literals
  const safeSessionToken = escapeForJsString(sessionToken);
  const safeGwAuthToken = escapeForJsString(gwAuthToken);
  const safeRedirectUrl = escapeForJsString(redirectUrl);

  // Serialize allowed origins for embedding in the HTML response
  // Use escapeForJsString to prevent XSS via </script> injection in env var values
  const allowedOrigins = getAllowedEmbedOrigins();
  const allowedOriginsJson =
    "[" +
    allowedOrigins.map((o) => `"${escapeForJsString(o)}"`).join(",") +
    "]";

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
        // Security: Only send to trusted GatewayZ origins
        if (window.parent && window.parent !== window) {
          var allowedOrigins = ${allowedOriginsJson};
          var message = {
            type: 'TERRAGON_AUTH_COMPLETE',
            success: true
          };
          allowedOrigins.forEach(function(origin) {
            try {
              window.parent.postMessage(message, origin);
            } catch (e) {
              // Ignore errors for origins that don't match the actual parent
            }
          });
        }
      } catch (e) {
        console.error('Failed to store session:', e);
      }

      // Navigate to dashboard
      window.location.href = '${safeRedirectUrl}';
    })();
  </script>
</body>
</html>`;
}

// Note: generateStandaloneAuthPage has been removed.
// For standalone GatewayZ auth, we now use a simpler approach:
// 1. Set the session token in an unsigned cookie (gw_session_token)
// 2. The middleware reads this cookie and forwards it as Authorization: Bearer header
// 3. This allows the server-side auth to validate the session using the bearer() plugin

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
    const rawReturnUrl = url.searchParams.get("returnUrl") || "/dashboard";
    // Validate returnUrl to prevent open redirect vulnerabilities
    // This is a defense-in-depth measure since initiate already validates,
    // but attackers could craft direct callback URLs bypassing initiate
    const returnUrl = validateReturnUrl(rawReturnUrl, baseUrl);
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

      try {
        await connectGatewayZToExistingUser(existingUserId, gwSession);
        console.log("GatewayZ callback: Connected to existing user", {
          userId: existingUserId,
          gwUserId: gwSession.gwUserId,
          tier: gwSession.tier,
        });

        // Redirect back to settings with success message
        // Use URL API to properly handle existing query params/fragments
        const successUrl = new URL(returnUrl, baseUrl);
        successUrl.searchParams.set("gatewayz_connected", "true");
        return NextResponse.redirect(successUrl);
      } catch (error) {
        // Handle collision error - GatewayZ account already linked to another user
        if (
          error instanceof Error &&
          error.message.includes("already linked to another user")
        ) {
          console.warn("GatewayZ callback: Account already linked", {
            userId: existingUserId,
            gwUserId: gwSession.gwUserId,
          });
          // Use URL API to properly handle existing query params/fragments
          const errorUrl = new URL(returnUrl, baseUrl);
          errorUrl.searchParams.set("error", "gatewayz_already_linked");
          return NextResponse.redirect(errorUrl);
        }
        throw error; // Re-throw other errors
      }
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

    const sessionCookieMaxAge = 60 * 60 * 24 * 60; // 60 days
    const gwTokenMaxAge = 60 * 60; // 1 hour

    // Build cookie strings for Set-Cookie headers (only used in embed mode)
    // In embed mode (iframe context), we need sameSite: "none" with secure: true
    // for cookies to work cross-site.
    const embedCookieOptions = `; Path=/; Secure; SameSite=None; Partitioned`;
    const embedCookies = [
      `better-auth.session_token=${sessionToken}; Max-Age=${sessionCookieMaxAge}; HttpOnly${embedCookieOptions}`,
      `gw_auth_token=${token}; Max-Age=${gwTokenMaxAge}; HttpOnly${embedCookieOptions}`,
      `gw_embed_mode=true; Max-Age=${gwTokenMaxAge}${embedCookieOptions}`,
    ];

    // In embed mode, return an HTML page that stores the session in sessionStorage
    // and notifies the parent. This avoids third-party cookie blocking issues.
    if (embed) {
      const html = generateEmbedAuthPage(redirectUrl, sessionToken, token);
      // Use Headers with append() for Set-Cookie - per RFC 7230, Set-Cookie cannot be comma-joined
      const headers = new Headers();
      headers.set("Content-Type", "text/html; charset=utf-8");
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      // Still try to set cookies (may work in some browsers), but don't rely on them
      for (const cookie of embedCookies) {
        headers.append("Set-Cookie", cookie);
      }
      return new Response(html, { status: 200, headers });
    }

    // For non-embed mode (standalone GatewayZ login), use a standard redirect with
    // an unsigned session token cookie. The middleware will read this cookie and
    // forward it as an Authorization: Bearer header, allowing the server-side auth
    // to validate the session using the bearer() plugin.
    const response = NextResponse.redirect(redirectUrl);

    // Set the session token in an unsigned cookie that the middleware can read
    // This is different from better-auth.session_token which requires signing
    response.cookies.set("gw_session_token", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookieMaxAge,
    });

    // Also set the GatewayZ auth token for reference
    response.cookies.set("gw_auth_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: gwTokenMaxAge,
    });

    // Mark as using GatewayZ standalone auth
    response.cookies.set("gw_standalone_auth", "true", {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookieMaxAge,
    });

    return response;
  } catch (error) {
    console.error("GatewayZ callback error:", error);
    return NextResponse.redirect(
      new URL("/login?error=internal_error", getBaseUrl(request)),
    );
  }
}
