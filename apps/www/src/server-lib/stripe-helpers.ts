import { db } from "@/lib/db";
import { getUser, updateUser } from "@terragon/shared/model/user";
import { stripeCustomersCreate } from "./stripe";

export async function ensureStripeCustomer({
  userId,
}: {
  userId: string;
}): Promise<{ customerId: string; email: string | null; name: string | null }> {
  const user = await getUser({ db, userId });
  if (!user) {
    throw new Error("User not found");
  }
  if (user.stripeCustomerId) {
    return {
      customerId: user.stripeCustomerId,
      email: user.email,
      name: user.name,
    };
  }
  const customer = await stripeCustomersCreate({
    email: user.email,
    name: user.name,
    metadata: {
      terragon_user_id: userId,
    },
  });
  await updateUser({ db, userId, updates: { stripeCustomerId: customer.id } });
  return {
    customerId: customer.id,
    email: user.email,
    name: user.name,
  };
}

/**
 * Detects Stripe "cannot combine currencies" errors.
 * This happens when a customer already has items in one currency (e.g. CAD)
 * and a new operation tries to use a different currency (e.g. USD).
 */
export function isStripeCurrencyMismatchError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("cannot combine currencies");
  }
  return false;
}

/**
 * Creates a fresh Stripe customer for a user, replacing their existing
 * stripeCustomerId. Used to recover from currency mismatch errors where
 * the old customer is locked to a non-USD currency.
 */
export async function recreateStripeCustomer({
  userId,
}: {
  userId: string;
}): Promise<string> {
  const user = await getUser({ db, userId });
  if (!user) {
    throw new Error("User not found");
  }
  console.warn(
    `Recreating Stripe customer for user ${userId} (old customer: ${user.stripeCustomerId}) due to currency mismatch`,
  );
  const customer = await stripeCustomersCreate({
    email: user.email,
    name: user.name,
    metadata: {
      terragon_user_id: userId,
    },
  });
  await updateUser({ db, userId, updates: { stripeCustomerId: customer.id } });
  return customer.id;
}
