import { db } from "@/lib/db";
import type {
  AccessInfo,
  AccessTier,
  BillingInfo,
} from "@terragon/shared/db/types";
import { getUserIdOrNull } from "./auth-server";
import {
  getSubscriptionInfoForUser,
  getSignupTrialInfoForUser,
  getUnusedPromotionCodeForUser,
} from "@terragon/shared/model/subscription";
import { getFeatureFlagsGlobal } from "@terragon/shared/model/feature-flags";
import { isStripeConfigured } from "@/server-lib/stripe";
import * as schema from "@terragon/shared/db/schema";
import { eq } from "drizzle-orm";
type GatewayZTier = "free" | "pro" | "max";

function resolvePaidTier(plan: string): AccessTier {
  switch (plan) {
    case "pro":
    case "core":
      return plan;
    default:
      console.warn(`Unknown plan: ${plan}. Falling back to core.`);
      return "core";
  }
}

/**
 * Maps GatewayZ tier to Terragon access tier.
 * - gw:free -> none
 * - gw:pro -> core (displayed as "Pro" in UI)
 * - gw:max -> pro (displayed as "Max" in UI)
 */
function mapGatewayZTierToAccessTier(gwTier: GatewayZTier): AccessTier {
  switch (gwTier) {
    case "pro":
      return "core"; // GatewayZ Pro maps to Terragon core (displayed as "Pro")
    case "max":
      return "pro"; // GatewayZ Max maps to Terragon pro (displayed as "Max")
    case "free":
    default:
      return "none";
  }
}

/**
 * Returns the access tier for the current user.
 * Priority:
 * 1. GatewayZ tier (if user authenticated via GatewayZ)
 * 2. Stripe subscription
 * 3. Signup trial
 * 4. "none" (free tier)
 *
 * If billing is disabled for the user or Stripe is not configured,
 * defaults to "core" (don't block in dev).
 */
export async function getAccessInfoForUser(
  userId: string,
): Promise<AccessInfo> {
  // First, check if user has a GatewayZ tier (they logged in via GatewayZ)
  const userRecord = await db
    .select({ gwTier: schema.user.gwTier })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  const gwTier = userRecord[0]?.gwTier as GatewayZTier | null | undefined;
  if (gwTier && gwTier !== "free") {
    // User has an active GatewayZ subscription - use that tier
    return { tier: mapGatewayZTierToAccessTier(gwTier) };
  }

  // Fall back to Stripe subscription check
  if (!isStripeConfigured()) {
    // Don't block in dev/misconfig
    return { tier: "core" };
  }
  const subscription = await getSubscriptionInfoForUser({
    db,
    userId,
    isActive: true,
  });
  if (subscription) {
    return { tier: resolvePaidTier(subscription.plan) };
  }
  // Maybe the user is on a signup trial
  const signupTrial = await getSignupTrialInfoForUser({
    db,
    userId,
  });
  // Within signup free-trial window → grant access as core with trial flag
  if (signupTrial?.isActive) {
    return { tier: signupTrial.plan };
  }
  return { tier: "none" };
}

/** Convenience wrapper for components/actions that want both pieces. */
export async function getBillingInfo(): Promise<BillingInfo> {
  const userId = await getUserIdOrNull();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return await getBillingInfoForUser({ userId });
}

export async function getBillingInfoForUser({
  userId,
}: {
  userId: string;
}): Promise<BillingInfo> {
  const [subscription, signupTrial, featureFlags] = await Promise.all([
    getSubscriptionInfoForUser({ db, userId }),
    getSignupTrialInfoForUser({ db, userId }),
    getFeatureFlagsGlobal({ db }),
  ]);
  const hasActiveSubscription = !!subscription?.isActive;
  const unusedPromotionCode = !hasActiveSubscription
    ? await getUnusedPromotionCodeForUser({ db, userId })
    : null;
  return {
    hasActiveSubscription,
    subscription,
    signupTrial,
    unusedPromotionCode: !!unusedPromotionCode,
    isShutdownMode: featureFlags.shutdownMode,
  };
}
