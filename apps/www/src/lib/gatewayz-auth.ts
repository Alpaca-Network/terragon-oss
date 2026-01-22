import { createHmac } from "crypto";

export interface GatewayZSession {
  gwUserId: number;
  email: string;
  username: string;
  tier: string;
  apiKey: string;
  exp: number;
  iat: number;
}

/**
 * Verify a GatewayZ auth token passed via query param or header.
 * Tokens are HMAC-SHA256 signed with a shared secret.
 */
export function verifyGatewayZToken(token: string): GatewayZSession | null {
  const bridgeSecret = process.env.GATEWAYZ_AUTH_BRIDGE_SECRET;
  if (!bridgeSecret) {
    console.warn("GATEWAYZ_AUTH_BRIDGE_SECRET not configured");
    return null;
  }

  try {
    const [payloadB64, signature] = token.split(".");

    if (!payloadB64 || !signature) {
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson);

    // Verify signature
    const expectedSig = createHmac("sha256", bridgeSecret)
      .update(JSON.stringify(payload))
      .digest("base64url");

    if (signature !== expectedSig) {
      console.warn("GatewayZ token signature mismatch");
      return null;
    }

    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      console.warn("GatewayZ token expired");
      return null;
    }

    return payload as GatewayZSession;
  } catch (error) {
    console.error("Failed to verify GatewayZ token:", error);
    return null;
  }
}

/**
 * Check if a request is coming from GatewayZ embed mode
 */
export function isGatewayZEmbed(request: Request): boolean {
  const url = new URL(request.url);
  return url.searchParams.get("embed") === "true";
}

/**
 * Extract GatewayZ auth token from request
 */
export function getGatewayZToken(request: Request): string | null {
  const url = new URL(request.url);

  // Check query param first (for iframe embedding)
  const tokenFromQuery = url.searchParams.get("gwauth");
  if (tokenFromQuery) {
    return tokenFromQuery;
  }

  // Check header (for API calls)
  const tokenFromHeader = request.headers.get("X-GatewayZ-Session");
  if (tokenFromHeader) {
    return tokenFromHeader;
  }

  return null;
}
