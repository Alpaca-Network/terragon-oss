import { describe, it, expect, afterEach } from "vitest";
import type { GatewayZSession } from "./gatewayz-auth";
import { db } from "./db";
import * as schema from "@terragon/shared/db/schema";
import { eq } from "drizzle-orm";

// Import functions to test
import {
  findOrCreateUserFromGatewayZ,
  createSessionForGatewayZUser,
  connectGatewayZToExistingUser,
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

  describe("connectGatewayZToExistingUser", () => {
    it("should update GatewayZ fields on existing user", async () => {
      // Create a user without GatewayZ fields
      const existingUserId = crypto.randomUUID();
      await db.insert(schema.user).values({
        id: existingUserId,
        email: `${testEmailPrefix}-connect@example.com`,
        name: "Connect User",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdUserIds.push(existingUserId);

      // Verify user has no GatewayZ fields initially
      const usersBefore = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, existingUserId));
      expect(usersBefore[0]!.gwUserId).toBeNull();
      expect(usersBefore[0]!.gwTier).toBeNull();

      // Connect GatewayZ
      const gwSession: GatewayZSession = {
        gwUserId: 44444,
        email: `${testEmailPrefix}-connect@example.com`,
        username: "connectuser",
        tier: "pro",
        keyHash: "connect123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      await connectGatewayZToExistingUser(existingUserId, gwSession);

      // Verify GatewayZ fields were updated
      const usersAfter = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, existingUserId));

      const user = usersAfter[0]!;
      expect(user.gwUserId).toBe(String(gwSession.gwUserId));
      expect(user.gwTier).toBe("pro");
      expect(user.gwTierUpdatedAt).toBeDefined();
    });

    it("should update tier when connecting different GatewayZ account", async () => {
      // Create a user with existing GatewayZ fields (free tier)
      const existingUserId = crypto.randomUUID();
      await db.insert(schema.user).values({
        id: existingUserId,
        email: `${testEmailPrefix}-upgrade@example.com`,
        name: "Upgrade User",
        emailVerified: true,
        gwUserId: "11111",
        gwTier: "free",
        gwTierUpdatedAt: new Date(Date.now() - 86400000), // 1 day ago
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdUserIds.push(existingUserId);

      // Connect with a pro tier
      const gwSession: GatewayZSession = {
        gwUserId: 55555,
        email: `${testEmailPrefix}-upgrade@example.com`,
        username: "upgradeuser",
        tier: "max",
        keyHash: "upgrade123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      await connectGatewayZToExistingUser(existingUserId, gwSession);

      // Verify tier was upgraded
      const users = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, existingUserId));

      const user = users[0]!;
      expect(user.gwUserId).toBe(String(gwSession.gwUserId));
      expect(user.gwTier).toBe("max");
    });

    it("should default to free tier when tier is empty", async () => {
      const existingUserId = crypto.randomUUID();
      await db.insert(schema.user).values({
        id: existingUserId,
        email: `${testEmailPrefix}-freetier@example.com`,
        name: "Free Tier User",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdUserIds.push(existingUserId);

      const gwSession: GatewayZSession = {
        gwUserId: 66666,
        email: `${testEmailPrefix}-freetier@example.com`,
        username: "freetieruser",
        tier: "", // Empty tier
        keyHash: "freetier123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      await connectGatewayZToExistingUser(existingUserId, gwSession);

      const users = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, existingUserId));

      expect(users[0]!.gwTier).toBe("free");
    });

    it("should throw error when GatewayZ account is already linked to another user", async () => {
      // Create first user with a GatewayZ account
      const firstUserId = crypto.randomUUID();
      await db.insert(schema.user).values({
        id: firstUserId,
        email: `${testEmailPrefix}-first@example.com`,
        name: "First User",
        emailVerified: true,
        gwUserId: "99999",
        gwTier: "pro",
        gwTierUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdUserIds.push(firstUserId);

      // Create second user without GatewayZ
      const secondUserId = crypto.randomUUID();
      await db.insert(schema.user).values({
        id: secondUserId,
        email: `${testEmailPrefix}-second@example.com`,
        name: "Second User",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdUserIds.push(secondUserId);

      // Try to connect the same GatewayZ account to second user
      const gwSession: GatewayZSession = {
        gwUserId: 99999, // Same as first user
        email: `${testEmailPrefix}-second@example.com`,
        username: "seconduser",
        tier: "pro",
        keyHash: "collision123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      await expect(
        connectGatewayZToExistingUser(secondUserId, gwSession),
      ).rejects.toThrow("already linked to another user");
    });

    it("should allow reconnecting the same GatewayZ account to the same user", async () => {
      // Create a user with a GatewayZ account
      const existingUserId = crypto.randomUUID();
      await db.insert(schema.user).values({
        id: existingUserId,
        email: `${testEmailPrefix}-same@example.com`,
        name: "Same User",
        emailVerified: true,
        gwUserId: "88888",
        gwTier: "free",
        gwTierUpdatedAt: new Date(Date.now() - 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdUserIds.push(existingUserId);

      // Reconnect with updated tier
      const gwSession: GatewayZSession = {
        gwUserId: 88888, // Same gwUserId
        email: `${testEmailPrefix}-same@example.com`,
        username: "sameuser",
        tier: "max", // Upgraded tier
        keyHash: "same123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      // Should not throw
      await connectGatewayZToExistingUser(existingUserId, gwSession);

      // Verify tier was updated
      const users = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, existingUserId));

      expect(users[0]!.gwTier).toBe("max");
    });
  });

  describe("findOrCreateUserFromGatewayZ - collision prevention", () => {
    it("should return existing user when GatewayZ account is already linked", async () => {
      // Create a user with a GatewayZ account
      const existingUserId = crypto.randomUUID();
      await db.insert(schema.user).values({
        id: existingUserId,
        email: `${testEmailPrefix}-linked@example.com`,
        name: "Linked User",
        emailVerified: true,
        gwUserId: "77777",
        gwTier: "pro",
        gwTierUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdUserIds.push(existingUserId);

      // Try to login with the same GatewayZ account but different email
      const gwSession: GatewayZSession = {
        gwUserId: 77777, // Same as existing user
        email: `${testEmailPrefix}-different@example.com`, // Different email
        username: "differentuser",
        tier: "max",
        keyHash: "linked123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const result = await findOrCreateUserFromGatewayZ(gwSession);

      // Should return the existing user, not create a new one
      expect(result.isNewUser).toBe(false);
      expect(result.userId).toBe(existingUserId);

      // Verify tier was updated
      const users = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, existingUserId));

      expect(users[0]!.gwTier).toBe("max");
      // Email should remain unchanged
      expect(users[0]!.email).toBe(`${testEmailPrefix}-linked@example.com`);
    });

    it("should prioritize gwUserId match over email match", async () => {
      // Create user A with gwUserId 11111
      const userAId = crypto.randomUUID();
      await db.insert(schema.user).values({
        id: userAId,
        email: `${testEmailPrefix}-usera@example.com`,
        name: "User A",
        emailVerified: true,
        gwUserId: "111111",
        gwTier: "free",
        gwTierUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdUserIds.push(userAId);

      // Create user B with email that matches the incoming session
      const userBId = crypto.randomUUID();
      await db.insert(schema.user).values({
        id: userBId,
        email: `${testEmailPrefix}-userb@example.com`,
        name: "User B",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdUserIds.push(userBId);

      // Login with gwUserId that matches User A, but email that matches User B
      const gwSession: GatewayZSession = {
        gwUserId: 111111, // Matches User A
        email: `${testEmailPrefix}-userb@example.com`, // Matches User B
        username: "confusinguser",
        tier: "pro",
        keyHash: "priority123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const result = await findOrCreateUserFromGatewayZ(gwSession);

      // Should return User A (gwUserId match takes precedence)
      expect(result.userId).toBe(userAId);
      expect(result.isNewUser).toBe(false);
    });
  });
});
