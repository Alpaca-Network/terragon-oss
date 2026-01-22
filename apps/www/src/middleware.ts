import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { searchParams, pathname } = new URL(request.url);
  const accessCode = searchParams.get("code");

  // Handle GatewayZ embed auth token
  const gwAuthToken = searchParams.get("gwauth");
  const isEmbed = searchParams.get("embed") === "true";

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
    if (isEmbed) {
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

  return NextResponse.next();
}

export const config = {
  // Match all routes to handle GatewayZ auth on any page
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
