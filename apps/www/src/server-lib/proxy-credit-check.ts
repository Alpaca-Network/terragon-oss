import { db } from "@/lib/db";
import { getUserCreditBalance } from "@terragon/shared/model/credits";
import { getAccessInfoForUser } from "@/lib/subscription";
import { maybeTriggerCreditAutoReload } from "./credit-auto-reload";
import { waitUntil } from "@vercel/functions";

export type CreditCheckResult =
  | { allowed: true; userId: string; balanceCents: number }
  | { allowed: false; response: Response };

/**
 * Checks if a user has sufficient credits or an active subscription to use the proxy.
 * Users with an active subscription (including trial) are allowed regardless of credit balance.
 * Users without a subscription need a positive credit balance.
 */
export async function checkProxyCredits(
  userId: string,
  provider: string,
): Promise<CreditCheckResult> {
  // Check subscription status first - users with active subscription don't need credits
  const accessInfo = await getAccessInfoForUser(userId);
  const hasActiveSubscription = accessInfo.tier !== "none";

  // Get credit balance (still needed for auto-reload trigger)
  const { balanceCents } = await getUserCreditBalance({
    db,
    userId,
    skipAggCache: false,
  });

  // Trigger auto-reload in background if needed
  waitUntil(maybeTriggerCreditAutoReload({ userId, balanceCents }));

  // Allow if user has active subscription OR positive credit balance
  if (hasActiveSubscription || balanceCents > 0) {
    return { allowed: true, userId, balanceCents };
  }

  console.log(`${provider} proxy access denied: insufficient credits`, {
    userId,
    balanceCents,
    tier: accessInfo.tier,
  });

  return {
    allowed: false,
    response: new Response("Insufficient credits", { status: 402 }),
  };
}
