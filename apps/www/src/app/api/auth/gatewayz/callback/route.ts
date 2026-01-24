import { NextRequest, NextResponse } from "next/server";
import { verifyGatewayZToken } from "@/lib/gatewayz-auth";
import { createSessionForGatewayZUser } from "@/lib/gatewayz-auth-server";
import { cookies } from "next/headers";

/**
 * GET /api/auth/gatewayz/callback
 *
 * Handle callback from GatewayZ login redirect.
 * Verifies the gwauth token, creates a session, and redirects to the target page.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("gwauth");
    const returnUrl = url.searchParams.get("returnUrl") || "/dashboard";
    const embed = url.searchParams.get("embed") === "true";

    if (!token) {
      console.error("GatewayZ callback: Missing token");
      return NextResponse.redirect(
        new URL(
          `/login?error=missing_token&returnUrl=${encodeURIComponent(returnUrl)}`,
          request.url,
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
          request.url,
        ),
      );
    }

    // Create or link user and create session
    const { sessionToken } = await createSessionForGatewayZUser(gwSession);

    // Set the session cookie (using the same cookie name as Better Auth)
    const cookieStore = await cookies();
    cookieStore.set("better-auth.session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 60, // 60 days to match Better Auth session expiry
    });

    // Also store GatewayZ token for API calls
    cookieStore.set("gw_auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60, // 1 hour to match GatewayZ token expiry
    });

    // Set embed mode cookie if applicable
    if (embed) {
      cookieStore.set("gw_embed_mode", "true", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60, // 1 hour
      });
    }

    // Redirect to the target page
    return NextResponse.redirect(new URL(returnUrl, request.url));
  } catch (error) {
    console.error("GatewayZ callback error:", error);
    return NextResponse.redirect(
      new URL("/login?error=internal_error", request.url),
    );
  }
}
