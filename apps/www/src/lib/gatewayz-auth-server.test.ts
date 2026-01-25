import { describe, it, expect, afterEach } from "vitest";
import type { GatewayZSession } from "./gatewayz-auth";
import { db } from "./db";
import * as schema from "@terragon/shared/db/schema";
import { eq } from "drizzle-orm";

// Import functions to test
import {
  findOrCreateUserFromGatewayZ,
  createSessionForGatewayZUser,
} from "./gatewayz-auth-server";

describe("gatewayz-auth-server", () => {
  // Track created users for cleanup
  const createdUserIds: string[] = [];
  const testEmailPrefix = `test-gw-${Date.now()}`;

  afterEach(async () => {
    // Clean up created sessions and users
    for (const userId of createdUserIds) {
      await db.delete(schema.session).where(eq(schema.session.userId, userId));
      await db.delete(schema.user).where(eq(schema.user.id, userId));
    }
    createdUserIds.length = 0;
  });

  describe("findOrCreateUserFromGatewayZ", () => {
    it("should create a new user when email does not exist", async () => {
      const gwSession: GatewayZSession = {
        gwUserId: 12345,
        email: `${testEmailPrefix}-new@example.com`,
        username: "newuser",
        tier: "pro",
        keyHash: "abc123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const result = await findOrCreateUserFromGatewayZ(gwSession);

      expect(result.isNewUser).toBe(true);
      expect(result.userId).toBeDefined();
      createdUserIds.push(result.userId);

      // Verify user was created in database
      const users = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, result.userId));

      expect(users).toHaveLength(1);
      const user = users[0]!;
      expect(user.email).toBe(gwSession.email);
      expect(user.name).toBe(gwSession.username);
      expect(user.gwUserId).toBe(String(gwSession.gwUserId));
      expect(user.gwTier).toBe("pro");
    });

    it("should link to existing user when email matches", async () => {
      // First create a user
      const existingUserId = crypto.randomUUID();
      await db.insert(schema.user).values({
        id: existingUserId,
        email: `${testEmailPrefix}-existing@example.com`,
        name: "Existing User",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdUserIds.push(existingUserId);

      const gwSession: GatewayZSession = {
        gwUserId: 67890,
        email: `${testEmailPrefix}-existing@example.com`,
        username: "gwuser",
        tier: "max",
        keyHash: "def456",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const result = await findOrCreateUserFromGatewayZ(gwSession);

      expect(result.isNewUser).toBe(false);
      expect(result.userId).toBe(existingUserId);

      // Verify GatewayZ fields were updated
      const users = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, existingUserId));

      const user = users[0]!;
      expect(user.gwUserId).toBe(String(gwSession.gwUserId));
      expect(user.gwTier).toBe("max");
      expect(user.gwTierUpdatedAt).toBeDefined();
    });

    it("should default tier to free when not provided", async () => {
      const gwSession: GatewayZSession = {
        gwUserId: 11111,
        email: `${testEmailPrefix}-notier@example.com`,
        username: "notieruser",
        tier: "", // Empty tier
        keyHash: "xyz789",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const result = await findOrCreateUserFromGatewayZ(gwSession);
      createdUserIds.push(result.userId);

      const users = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, result.userId));

      expect(users[0]!.gwTier).toBe("free");
    });
  });

  describe("createSessionForGatewayZUser", () => {
    it("should create a session with 60-day expiry", async () => {
      const gwSession: GatewayZSession = {
        gwUserId: 22222,
        email: `${testEmailPrefix}-session@example.com`,
        username: "sessionuser",
        tier: "pro",
        keyHash: "session123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const beforeCreate = new Date();
      const result = await createSessionForGatewayZUser(gwSession);
      createdUserIds.push(result.userId);

      expect(result.sessionToken).toBeDefined();
      expect(result.userId).toBeDefined();

      // Verify session was created in database
      const sessions = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.token, result.sessionToken));

      expect(sessions).toHaveLength(1);
      const session = sessions[0]!;
      expect(session.userId).toBe(result.userId);

      // Verify expiry is approximately 60 days from now
      const expiresAt = session.expiresAt;
      const expectedExpiry = new Date(
        beforeCreate.getTime() + 60 * 24 * 60 * 60 * 1000,
      );
      const diffMs = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      // Allow 5 second tolerance for test execution time
      expect(diffMs).toBeLessThan(5000);
    });

    it("should reuse existing user when creating session", async () => {
      // Create first session
      const gwSession: GatewayZSession = {
        gwUserId: 33333,
        email: `${testEmailPrefix}-reuse@example.com`,
        username: "reuseuser",
        tier: "max",
        keyHash: "reuse123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const result1 = await createSessionForGatewayZUser(gwSession);
      createdUserIds.push(result1.userId);

      // Create second session for same email
      const result2 = await createSessionForGatewayZUser(gwSession);

      // Should be same user
      expect(result2.userId).toBe(result1.userId);
      // But different session tokens
      expect(result2.sessionToken).not.toBe(result1.sessionToken);

      // Clean up second session
      await db
        .delete(schema.session)
        .where(eq(schema.session.token, result2.sessionToken));
    });
  });
});
