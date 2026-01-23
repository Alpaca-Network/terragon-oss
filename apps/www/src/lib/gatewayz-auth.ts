import { createHmac, createDecipheriv } from "crypto";

export interface GatewayZSession {
  gwUserId: number;
  email: string;
  username: string;
  tier: string;
  keyHash: string; // Hash of API key, not the key itself
  exp: number;
  iat: number;
}

/**
 * Decrypt an AES-256-GCM encrypted payload
 * Format: iv.ciphertext.authTag (all base64url encoded)
 */
function decryptPayload(encryptedPayload: string, secret: string): string {
  const key = Buffer.from(secret.padEnd(32, "0").slice(0, 32)); // Ensure 32 bytes
  const [ivB64, encrypted, authTagB64] = encryptedPayload.split(".");

  if (!ivB64 || !encrypted || !authTagB64) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(authTagB64, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "base64url", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Verify a GatewayZ auth token passed via query param or header.
 * Tokens are encrypted with AES-256-GCM and signed with HMAC-SHA256.
 *
 * Token format: iv.ciphertext.authTag.signature
 */
export function verifyGatewayZToken(token: string): GatewayZSession | null {
  const bridgeSecret = process.env.GATEWAYZ_AUTH_BRIDGE_SECRET;
  if (!bridgeSecret) {
    console.warn("GATEWAYZ_AUTH_BRIDGE_SECRET not configured");
    return null;
  }

  try {
    // Token format: iv.encrypted.authTag.signature
    // Find the last dot to split encrypted payload from signature
    const lastDotIndex = token.lastIndexOf(".");
    if (lastDotIndex === -1) {
      console.warn("GatewayZ token invalid format: missing signature");
      return null;
    }

    const encryptedPayload = token.slice(0, lastDotIndex);
    const signature = token.slice(lastDotIndex + 1);

    if (!encryptedPayload || !signature) {
      return null;
    }

    // Verify signature first (sign the encrypted payload, not the decrypted)
    const expectedSig = createHmac("sha256", bridgeSecret)
      .update(encryptedPayload)
      .digest("base64url");

    if (signature !== expectedSig) {
      console.warn("GatewayZ token signature mismatch");
      return null;
    }

    // Decrypt and parse payload
    const payloadJson = decryptPayload(encryptedPayload, bridgeSecret);
    const payload = JSON.parse(payloadJson);

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
