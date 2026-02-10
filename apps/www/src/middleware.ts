import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Cookie name for storing the session token from GatewayZ standalone auth.
 * This is an unsigned cookie that the middleware can read and forward as a Bearer token.
 */
const GW_SESSION_COOKIE = "gw_session_token";

/**
 * Get the GatewayZ URL to redirect to when users visit Terragon directly.
 * This enables seamless SSO by redirecting to the GatewayZ-hosted inbox.
 *
 * NOTE: Redirect is DISABLED by default. Set NEXT_PUBLIC_GATEWAYZ_URL to enable.
 * This prevents redirect loops when terragon-oss is embedded in GatewayZ.
 */
function getGatewayZInboxUrl(): string | null {
  // Only redirect if explicitly configured - no default to prevent loops
  const gatewayZUrl = process.env.NEXT_PUBLIC_GATEWAYZ_URL;
  if (!gatewayZUrl) {
    return null; // Disabled by default
  }
  try {
    const url = new URL("/inbox", gatewayZUrl);
    return url.toString();
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { searchParams, pathname } = new URL(request.url);
  const accessCode = searchParams.get("code");

  // Handle GatewayZ embed auth token
  const gwAuthToken = searchParams.get("gwauth");
  const isEmbed = searchParams.get("embed") === "true";
  const awaitAuth = searchParams.get("awaitAuth") === "true";

  // Check if user has embed mode cookie (set when embedded in GatewayZ)
  const hasEmbedCookie = request.cookies.get("gw_embed_mode")?.value === "true";

  // Check if user is already authenticated with Terragon
  const hasSessionToken = request.cookies.has("better-auth.session_token");

  // Check for GatewayZ standalone auth session token (unsigned cookie)
  // This is set during the GatewayZ standalone auth flow
  const gwSessionToken = request.cookies.get(GW_SESSION_COOKIE)?.value;

  // Check if request is coming from an iframe using Sec-Fetch-Dest header
  // This is more reliable than query params which can be lost during navigation
  const secFetchDest = request.headers.get("Sec-Fetch-Dest");
  const isIframeRequest = secFetchDest === "iframe";

  // Also check for RSC (React Server Components) requests which shouldn't redirect
  const isRscRequest = request.headers.has("rsc");

  // Redirect direct visits to GatewayZ inbox for seamless SSO
  // Only redirect if:
  // 1. Not in embed mode (not loaded in iframe)
  // 2. Not awaiting auth (not in the middle of SSO flow)
  // 3. Not already authenticated
  // 4. Not on auth callback or API routes
  // 5. On the root or login page (main entry points)
  // 6. Not an iframe request (detected via Sec-Fetch-Dest header)
  // 7. Not an RSC request (would cause CORS issues)
  const isAuthCallback = pathname.startsWith("/api/auth");
  const isPublicEntryPoint = pathname === "/" || pathname === "/login";

  if (
    !isEmbed &&
    !awaitAuth &&
    !hasEmbedCookie &&
    !hasSessionToken &&
    !gwSessionToken &&
    !isAuthCallback &&
    !gwAuthToken &&
    !isIframeRequest &&
    !isRscRequest &&
    isPublicEntryPoint
  ) {
    const gatewayZInboxUrl = getGatewayZInboxUrl();
    if (gatewayZInboxUrl) {
      return NextResponse.redirect(gatewayZInboxUrl);
    }
  }

  // Set embed mode cookie if we detect iframe context (even without gwauth token)
  // This ensures subsequent navigations within the iframe don't trigger redirects
  if ((isEmbed || isIframeRequest) && !hasEmbedCookie) {
    const response = NextResponse.next();
    response.cookies.set("gw_embed_mode", "true", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    // If no gwauth token, just continue with the embed cookie set
    if (!gwAuthToken) {
      return response;
    }
  }

  if (gwAuthToken) {
    // Create response to continue to the page
    const response = NextResponse.next();

    // Store the GatewayZ auth token in a cookie for subsequent requests
    response.cookies.set("gw_auth_token", gwAuthToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour (matches token expiry)
      path: "/",
    });

    // Store embed mode preference
    if (isEmbed || isIframeRequest) {
      response.cookies.set("gw_embed_mode", "true", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });
    }

    // Remove the gwauth token from URL but keep embed param for client-side use
    const url = new URL(request.url);
    url.searchParams.delete("gwauth");

    // Redirect to clean URL
    return NextResponse.redirect(url, {
      headers: response.headers,
    });
  }

  // Only process if we have an access code and we're on a public page
  if (
    accessCode &&
    (pathname === "/" || pathname === "/login" || pathname === "/invited")
  ) {
    // Create response to continue to the page
    const response = NextResponse.next();

    // Set the access code as a cookie
    response.cookies.set("access_code", accessCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    // Remove the code from the URL to keep it clean
    const url = new URL(request.url);
    url.searchParams.delete("code");

    // Redirect to the clean URL
    return NextResponse.redirect(url, {
      headers: response.headers,
    });
  }

  // Forward GatewayZ session token as Authorization header if present
  // This allows the server-side auth check to validate the session using the Bearer token mechanism
  // The token is stored in an unsigned cookie during GatewayZ standalone auth
  if (gwSessionToken && !hasSessionToken) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Authorization", `Bearer ${gwSessionToken}`);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes to handle GatewayZ auth on any page
  // Exclude /inbox/docs to allow public access to documentation
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|inbox/docs).*)"],
};
