import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { createHmac, createCipheriv, randomBytes, hkdfSync } from "crypto";
import {
  verifyGatewayZToken,
  isGatewayZEmbed,
  getGatewayZToken,
} from "./gatewayz-auth";

// Store original env
const originalEnv = process.env;

// Derive key using HKDF to match the implementation
function deriveKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", secret, "", "gatewayz-terragon-auth", 32),
  );
}

// Helper to encrypt payload for testing (matching the frontend implementation)
function encryptPayload(payload: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(payload, "utf8", "base64url");
  encrypted += cipher.final("base64url");
  const authTag = cipher.getAuthTag().toString("base64url");

  return `${iv.toString("base64url")}.${encrypted}.${authTag}`;
}

// Helper to create a valid token for testing
function createTestToken(payload: object, secret: string): string {
  const payloadJson = JSON.stringify(payload);
  const encryptedPayload = encryptPayload(payloadJson, secret);
  const signature = createHmac("sha256", secret)
    .update(encryptedPayload)
    .digest("base64url");
  return `${encryptedPayload}.${signature}`;
}

describe("gatewayz-auth", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.GATEWAYZ_AUTH_BRIDGE_SECRET = "test-secret-key-for-testing";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("verifyGatewayZToken", () => {
    it("should return null when bridge secret is not configured", () => {
      delete process.env.GATEWAYZ_AUTH_BRIDGE_SECRET;

      const token = "some.token.here";
      const result = verifyGatewayZToken(token);

      expect(result).toBeNull();
    });

    it("should return null for invalid token format", () => {
      const result = verifyGatewayZToken("invalid-token-no-dots");
      expect(result).toBeNull();
    });

    it("should return null when signature doesn't match", () => {
      const secret = "test-secret-key-for-testing";
      const payload = {
        gwUserId: 123,
        email: "test@example.com",
        username: "testuser",
        tier: "pro",
        keyHash: "abc123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const payloadJson = JSON.stringify(payload);
      const encryptedPayload = encryptPayload(payloadJson, secret);
      // Use wrong signature
      const wrongSignature = "wrong-signature";
      const token = `${encryptedPayload}.${wrongSignature}`;

      const result = verifyGatewayZToken(token);
      expect(result).toBeNull();
    });

    it("should return null for expired tokens", () => {
      const secret = "test-secret-key-for-testing";
      const payload = {
        gwUserId: 123,
        email: "test@example.com",
        username: "testuser",
        tier: "pro",
        keyHash: "abc123",
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
      };

      const token = createTestToken(payload, secret);
      const result = verifyGatewayZToken(token);

      expect(result).toBeNull();
    });

    it("should successfully verify and decrypt a valid token", () => {
      const secret = "test-secret-key-for-testing";
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        gwUserId: 123,
        email: "test@example.com",
        username: "testuser",
        tier: "pro",
        keyHash: "abc123def456",
        exp: now + 3600,
        iat: now,
      };

      const token = createTestToken(payload, secret);
      const result = verifyGatewayZToken(token);

      expect(result).not.toBeNull();
      expect(result?.gwUserId).toBe(123);
      expect(result?.email).toBe("test@example.com");
      expect(result?.username).toBe("testuser");
      expect(result?.tier).toBe("pro");
      expect(result?.keyHash).toBe("abc123def456");
    });

    it("should successfully verify and decrypt a token with credits fields", () => {
      const secret = "test-secret-key-for-testing";
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        gwUserId: 123,
        email: "test@example.com",
        username: "testuser",
        tier: "pro",
        credits: 5000, // $50 in cents
        subscriptionAllowance: 2000, // $20 monthly allowance
        purchasedCredits: 3000, // $30 purchased
        keyHash: "abc123def456",
        exp: now + 3600,
        iat: now,
      };

      const token = createTestToken(payload, secret);
      const result = verifyGatewayZToken(token);

      expect(result).not.toBeNull();
      expect(result?.gwUserId).toBe(123);
      expect(result?.email).toBe("test@example.com");
      expect(result?.tier).toBe("pro");
      expect(result?.credits).toBe(5000);
      expect(result?.subscriptionAllowance).toBe(2000);
      expect(result?.purchasedCredits).toBe(3000);
    });

    it("should handle different payload key orderings correctly", () => {
      // This test ensures the signature verification works regardless of JSON key order
      const secret = "test-secret-key-for-testing";
      const now = Math.floor(Date.now() / 1000);

      // Create payload with different key ordering
      const payload1 = {
        gwUserId: 123,
        email: "test@example.com",
        username: "testuser",
        tier: "pro",
        keyHash: "abc123",
        exp: now + 3600,
        iat: now,
      };

      const payload2 = {
        iat: now,
        exp: now + 3600,
        keyHash: "abc123",
        tier: "pro",
        username: "testuser",
        email: "test@example.com",
        gwUserId: 123,
      };

      // Both should create valid tokens that can be verified
      const token1 = createTestToken(payload1, secret);
      const token2 = createTestToken(payload2, secret);

      const result1 = verifyGatewayZToken(token1);
      const result2 = verifyGatewayZToken(token2);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1?.gwUserId).toBe(123);
      expect(result2?.gwUserId).toBe(123);
    });
  });

  describe("isGatewayZEmbed", () => {
    it("should return true when embed=true in query params", () => {
      const request = new Request("https://example.com?embed=true");
      expect(isGatewayZEmbed(request)).toBe(true);
    });

    it("should return false when embed is not set", () => {
      const request = new Request("https://example.com");
      expect(isGatewayZEmbed(request)).toBe(false);
    });

    it("should return false when embed has different value", () => {
      const request = new Request("https://example.com?embed=false");
      expect(isGatewayZEmbed(request)).toBe(false);
    });
  });

  describe("getGatewayZToken", () => {
    it("should extract token from query parameter", () => {
      const request = new Request("https://example.com?gwauth=test-token");
      expect(getGatewayZToken(request)).toBe("test-token");
    });

    it("should extract token from header", () => {
      const request = new Request("https://example.com", {
        headers: {
          "X-GatewayZ-Session": "header-token",
        },
      });
      expect(getGatewayZToken(request)).toBe("header-token");
    });

    it("should prefer query parameter over header", () => {
      const request = new Request("https://example.com?gwauth=query-token", {
        headers: {
          "X-GatewayZ-Session": "header-token",
        },
      });
      expect(getGatewayZToken(request)).toBe("query-token");
    });

    it("should return null when no token is present", () => {
      const request = new Request("https://example.com");
      expect(getGatewayZToken(request)).toBeNull();
    });
  });
});
