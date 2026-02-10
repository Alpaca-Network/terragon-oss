import Stripe from "stripe";
import { env } from "@terragon/env/apps-www";

export function isStripeConfigured(): boolean {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    console.warn(
      "Stripe is not configured - missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET",
    );
    return false;
  }
  if (!env.STRIPE_PRICE_CORE_MONTHLY || !env.STRIPE_PRICE_PRO_MONTHLY) {
    console.warn(
      "Stripe is not configured - missing STRIPE_PRICE_CORE_MONTHLY or STRIPE_PRICE_PRO_MONTHLY",
    );
    return false;
  }
  return true;
}

export function isStripeConfiguredForCredits(): boolean {
  if (!isStripeConfigured()) {
    return false;
  }
  if (!env.STRIPE_PRICE_CREDIT_PACK) {
    console.warn("Stripe is not configured - missing STRIPE_PRICE_CREDIT_PACK");
    return false;
  }
  return true;
}

export function assertStripeConfigured(): void {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured");
  }
}

export function assertStripeConfiguredForCredits(): void {
  if (!isStripeConfiguredForCredits()) {
    throw new Error("Stripe is not configured for credits");
  }
}

export function getStripeClient(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export const STRIPE_PLAN_CONFIGS = [
  ...(env.STRIPE_PRICE_CORE_MONTHLY
    ? [{ name: "core", priceId: env.STRIPE_PRICE_CORE_MONTHLY }]
    : []),
  ...(env.STRIPE_PRICE_PRO_MONTHLY
    ? [{ name: "pro", priceId: env.STRIPE_PRICE_PRO_MONTHLY }]
    : []),
];

export function getStripeWebhookSecret(): string {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured");
  }
  return env.STRIPE_WEBHOOK_SECRET;
}

export function getStripeCreditPackPriceId(): string {
  if (!isStripeConfiguredForCredits()) {
    throw new Error("Stripe is not configured for credits");
  }
  return env.STRIPE_PRICE_CREDIT_PACK;
}

/**
 * Wrappers for Stripe API methods to make them easier to mock in tests
 */
export async function stripeCheckoutSessionsCreate(
  params: Stripe.Checkout.SessionCreateParams,
) {
  return getStripeClient().checkout.sessions.create(params);
}

export async function stripeCustomersCreate(
  params: Stripe.CustomerCreateParams,
) {
  return getStripeClient().customers.create(params);
}

export function stripeInvoicesCreate(params: Stripe.InvoiceCreateParams) {
  return getStripeClient().invoices.create(params);
}

export function stripeInvoiceItemsCreate(
  params: Stripe.InvoiceItemCreateParams,
) {
  return getStripeClient().invoiceItems.create(params);
}

export function stripeInvoicesFinalizeInvoice(invoiceId: string) {
  return getStripeClient().invoices.finalizeInvoice(invoiceId);
}

export function stripeInvoicesPay(
  invoiceId: string,
  params: Stripe.InvoicePayParams,
) {
  return getStripeClient().invoices.pay(invoiceId, params);
}

export function stripeCouponsCreate(params: Stripe.CouponCreateParams) {
  return getStripeClient().coupons.create(params);
}

export function stripePromotionCodesCreate(
  params: Stripe.PromotionCodeCreateParams,
  options?: Stripe.RequestOptions,
) {
  return getStripeClient().promotionCodes.create(params, options);
}

/**
 * Checks if an error is a Stripe error by checking for the presence of
 * Stripe-specific properties. This is more reliable than instanceof in
 * test environments where the Stripe module may be mocked.
 */
function isStripeError(
  error: unknown,
): error is { code?: string; type?: string; name?: string } {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  // Stripe errors have a specific structure with type/code and name starting with "Stripe"
  const err = error as Record<string, unknown>;
  return (
    typeof err.name === "string" &&
    err.name.startsWith("Stripe") &&
    (typeof err.type === "string" || typeof err.code === "string")
  );
}

/**
 * Sanitizes error messages from Stripe API calls to avoid exposing sensitive
 * operational details (API keys, internal configuration, etc.) to end users.
 *
 * For Stripe errors, we extract the safe error code/type. For other errors,
 * we return a generic message to avoid information disclosure.
 */
export function getSafeStripeErrorMessage(error: unknown): string {
  // Stripe errors have a specific structure with safe error codes
  if (isStripeError(error)) {
    // Stripe error codes are safe to expose (e.g., "card_declined", "invalid_request_error")
    // They don't contain sensitive configuration details
    const code = error.code;
    const type = error.type;

    if (code) {
      return `Stripe error: ${code}`;
    }
    if (type) {
      return `Stripe error: ${type}`;
    }
    return "Stripe error occurred";
  }

  // For non-Stripe errors, don't expose the raw message as it may contain
  // sensitive details like database connection strings, API keys, etc.
  return "An unexpected error occurred";
}
