import { NextRequest, NextResponse } from "next/server";
import { verifyGatewayZToken } from "@/lib/gatewayz-auth";
import { createSessionForGatewayZUser } from "@/lib/gatewayz-auth-server";

/**
 * POST /api/auth/gatewayz
 *
 * Exchange a GatewayZ auth token for a terragon-oss session.
 * This endpoint is called when a user accesses terragon-oss from GatewayZ.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Verify the GatewayZ token
    const gwSession = verifyGatewayZToken(token);
    if (!gwSession) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    // Create or link user and create session
    const { sessionToken, userId } =
      await createSessionForGatewayZUser(gwSession);

    // Return session info
    return NextResponse.json({
      success: true,
      sessionToken,
      userId,
      user: {
        email: gwSession.email,
        username: gwSession.username,
        tier: gwSession.tier,
      },
    });
  } catch (error) {
    console.error("GatewayZ auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/auth/gatewayz
 *
 * Check if the current request has a valid GatewayZ session.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("gw_auth_token")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const gwSession = verifyGatewayZToken(token);
  if (!gwSession) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      email: gwSession.email,
      username: gwSession.username,
      tier: gwSession.tier,
    },
  });
}
