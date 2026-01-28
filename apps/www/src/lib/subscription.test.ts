import { describe, it, expect, afterEach, vi } from "vitest";
import { db } from "./db";
import * as schema from "@terragon/shared/db/schema";
import { eq } from "drizzle-orm";
import { getAccessInfoForUser, getBillingInfoForUser } from "./subscription";

// Mock stripe configuration check
vi.mock("@/server-lib/stripe", () => ({
  isStripeConfigured: () => true,
}));

describe("subscription", () => {
  const testEmailPrefix = `test-subscription-${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdSubscriptionIds: string[] = [];

  afterEach(async () => {
    // Clean up created subscriptions
    for (const id of createdSubscriptionIds) {
      await db
        .delete(schema.subscription)
        .where(eq(schema.subscription.id, id));
    }
    createdSubscriptionIds.length = 0;

    // Clean up created users
    for (const userId of createdUserIds) {
      await db.delete(schema.user).where(eq(schema.user.id, userId));
    }
    createdUserIds.length = 0;
  });

  async function createTestUser(
    overrides: Partial<typeof schema.user.$inferInsert> = {},
  ) {
    const userId = crypto.randomUUID();
    const now = new Date();
    await db.insert(schema.user).values({
      id: userId,
      email: `${testEmailPrefix}-${userId}@example.com`,
      name: "Test User",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
    createdUserIds.push(userId);
    return userId;
  }

  async function createTestSubscription(
    userId: string,
    overrides: Partial<typeof schema.subscription.$inferInsert> = {},
  ) {
    const subscriptionId = crypto.randomUUID();
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    await db.insert(schema.subscription).values({
      id: subscriptionId,
      referenceId: userId,
      plan: "core",
      status: "active",
      periodStart: now,
      periodEnd,
      stripeCustomerId: `cus_test_${subscriptionId}`,
      stripeSubscriptionId: `sub_test_${subscriptionId}`,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
    createdSubscriptionIds.push(subscriptionId);
    return subscriptionId;
  }

  describe("getAccessInfoForUser", () => {
    it("should return GatewayZ tier when gwTier is pro", async () => {
      const userId = await createTestUser({ gwTier: "pro" });

      const result = await getAccessInfoForUser(userId);

      expect(result.tier).toBe("core"); // GatewayZ "pro" maps to Terragon "core"
    });

    it("should return GatewayZ tier when gwTier is max", async () => {
      const userId = await createTestUser({ gwTier: "max" });

      const result = await getAccessInfoForUser(userId);

      expect(result.tier).toBe("pro"); // GatewayZ "max" maps to Terragon "pro"
    });

    it("should fall back to Stripe subscription when gwTier is free", async () => {
      const userId = await createTestUser({ gwTier: "free" });
      await createTestSubscription(userId, { plan: "pro" });

      const result = await getAccessInfoForUser(userId);

      expect(result.tier).toBe("pro"); // Uses Stripe subscription
    });

    it("should fall back to Stripe subscription when gwTier is not set", async () => {
      const userId = await createTestUser({ gwTier: null });
      await createTestSubscription(userId, { plan: "core" });

      const result = await getAccessInfoForUser(userId);

      expect(result.tier).toBe("core");
    });

    it("should prioritize GatewayZ tier over Stripe subscription", async () => {
      const userId = await createTestUser({ gwTier: "max" });
      // Create a Stripe subscription with a different plan
      await createTestSubscription(userId, { plan: "core" });

      const result = await getAccessInfoForUser(userId);

      // GatewayZ "max" should take priority over Stripe "core"
      expect(result.tier).toBe("pro"); // GatewayZ "max" maps to Terragon "pro"
    });

    it("should return signup trial tier when no subscription and within trial period", async () => {
      // Create user without GatewayZ tier and within trial period (14 days)
      const now = new Date();
      const userId = await createTestUser({
        gwTier: null,
        createdAt: now,
        signupTrialPlan: "pro",
      });

      const result = await getAccessInfoForUser(userId);

      expect(result.tier).toBe("pro");
    });

    it("should return none when no GatewayZ, no subscription, and trial expired", async () => {
      // Create user with expired trial (more than 14 days ago)
      const expiredDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const userId = await createTestUser({
        gwTier: null,
        createdAt: expiredDate,
        signupTrialPlan: "core",
      });

      const result = await getAccessInfoForUser(userId);

      expect(result.tier).toBe("none");
    });
  });

  describe("getBillingInfoForUser", () => {
    it("should include GatewayZ tier info when user has gwTier=pro", async () => {
      const userId = await createTestUser({ gwTier: "pro" });

      const result = await getBillingInfoForUser({ userId });

      expect(result.gatewayZTier).not.toBeNull();
      expect(result.gatewayZTier?.tier).toBe("pro");
      expect(result.gatewayZTier?.mappedAccessTier).toBe("core");
    });

    it("should include GatewayZ tier info when user has gwTier=max", async () => {
      const userId = await createTestUser({ gwTier: "max" });

      const result = await getBillingInfoForUser({ userId });

      expect(result.gatewayZTier).not.toBeNull();
      expect(result.gatewayZTier?.tier).toBe("max");
      expect(result.gatewayZTier?.mappedAccessTier).toBe("pro");
    });

    it("should return null gatewayZTier when user has gwTier=free", async () => {
      const userId = await createTestUser({ gwTier: "free" });

      const result = await getBillingInfoForUser({ userId });

      expect(result.gatewayZTier).toBeNull();
    });

    it("should return null gatewayZTier when user has no gwTier", async () => {
      const userId = await createTestUser({ gwTier: null });

      const result = await getBillingInfoForUser({ userId });

      expect(result.gatewayZTier).toBeNull();
    });

    it("should include both GatewayZ tier and Stripe subscription info", async () => {
      const userId = await createTestUser({ gwTier: "max" });
      await createTestSubscription(userId, { plan: "core" });

      const result = await getBillingInfoForUser({ userId });

      // Both should be present
      expect(result.gatewayZTier).not.toBeNull();
      expect(result.gatewayZTier?.tier).toBe("max");
      expect(result.subscription).not.toBeNull();
      expect(result.subscription?.plan).toBe("core");
      expect(result.hasActiveSubscription).toBe(true);
    });

    it("should include subscription info for active subscription", async () => {
      const userId = await createTestUser({ gwTier: null });
      await createTestSubscription(userId, { plan: "pro", status: "active" });

      const result = await getBillingInfoForUser({ userId });

      expect(result.hasActiveSubscription).toBe(true);
      expect(result.subscription?.plan).toBe("pro");
      expect(result.subscription?.isActive).toBe(true);
    });

    it("should include signup trial info when user is on trial", async () => {
      const now = new Date();
      const userId = await createTestUser({
        gwTier: null,
        createdAt: now,
        signupTrialPlan: "core",
      });

      const result = await getBillingInfoForUser({ userId });

      expect(result.signupTrial).not.toBeNull();
      expect(result.signupTrial?.isActive).toBe(true);
      expect(result.signupTrial?.plan).toBe("core");
      expect(result.signupTrial?.daysRemaining).toBeGreaterThan(0);
    });
  });
});
