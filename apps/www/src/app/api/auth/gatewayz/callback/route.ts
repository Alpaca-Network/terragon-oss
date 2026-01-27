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
 * Generate an HTML page that sets cookies via meta refresh and then redirects.
 * This approach works better in iframe contexts where Set-Cookie on redirects
 * may not be processed correctly due to third-party cookie restrictions.
 */
function generateCookieSetterPage(
  redirectUrl: string,
  sessionToken: string,
  gwAuthToken: string,
  isEmbed: boolean,
): string {
  // For embed mode, we use a meta refresh approach which processes Set-Cookie headers
  // more reliably than a 302 redirect in iframe contexts
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <title>Authenticating...</title>
</head>
<body>
  <p>Authenticating, please wait...</p>
  <script>
    // Fallback navigation in case meta refresh doesn't work
    setTimeout(function() {
      window.location.href = "${redirectUrl}";
    }, 100);
  </script>
</body>
</html>`;
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
      cookies.push(`gw_embed_mode=true; Max-Age=${gwTokenMaxAge}${cookieOptions}`);
    }

    // In embed mode, return an HTML page that will process cookies and redirect
    // This works more reliably than a 302 redirect for iframe cookie handling
    if (embed) {
      const html = generateCookieSetterPage(redirectUrl, sessionToken, token, embed);
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
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
