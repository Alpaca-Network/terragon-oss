"use server";

import { headers } from "next/headers";
import { userOnlyAction } from "@/lib/auth-server";
import { auth } from "@/lib/auth";
import { publicAppUrl } from "@terragon/env/next-public";
import { db } from "@/lib/db";
import { assertStripeConfigured } from "@/server-lib/stripe";
import { getBillingInfo as getBillingInfoInternal } from "@/lib/subscription";
import { AccessTier } from "@terragon/shared";
import {
  getSubscriptionInfoForUser,
  setSignupTrialPlanForUser,
} from "@terragon/shared/model/subscription";
import { UserFacingError } from "@/lib/server-actions";
import { getFeatureFlagsGlobal } from "@terragon/shared/model/feature-flags";

export const getBillingInfoAction = userOnlyAction(
  async function getBillingInfoAction() {
    return await getBillingInfoInternal();
  },
  { defaultErrorMessage: "Failed to get billing info" },
);

export const getStripeCheckoutUrl = userOnlyAction(
  async function getStripeCheckoutUrl(
    userId: string,
    { plan = "core" }: { plan?: AccessTier } = {},
  ): Promise<string> {
    // Check if shutdown mode is enabled
    const flags = await getFeatureFlagsGlobal({ db });
    if (flags.shutdownMode) {
      throw new UserFacingError(
        "New subscriptions are no longer available. Terragon is shutting down on February 14th, 2026.",
      );
    }

    try {
      assertStripeConfigured();
    } catch (error) {
      console.error("Stripe configuration check failed:", error);
      throw new UserFacingError(
        "Stripe billing is not configured. Please contact support.",
      );
    }
    const subscription = await getSubscriptionInfoForUser({
      db,
      userId,
    });
    const normalizedPlan = plan === "pro" ? "pro" : "core";
    let baseUrl: string;
    try {
      baseUrl = publicAppUrl();
    } catch (error) {
      console.error("Failed to resolve app URL:", error);
      throw new UserFacingError(
        "Application URL is not configured. Please contact support.",
      );
    }
    const successUrl = `${baseUrl}/settings/billing?checkout=success`;
    const cancelUrl = `${baseUrl}/settings/billing?checkout=cancelled`;

    // Use Better Auth's Stripe plugin to create the checkout session
    let res: Record<string, unknown>;
    try {
      res = (await auth.api.upgradeSubscription({
        body: {
          plan: normalizedPlan,
          successUrl,
          cancelUrl,
          disableRedirect: true,
          subscriptionId: subscription?.id,
        },
        headers: await headers(),
      })) as Record<string, unknown>;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Stripe upgradeSubscription failed:", message, error);
      throw new UserFacingError(
        `Failed to get Stripe checkout URL: ${message}`,
      );
    }
    // Both response paths (billing portal upgrade and new checkout session)
    // include a `url` property at the top level.
    const url = typeof res?.url === "string" ? res.url : undefined;
    if (!url) {
      console.error(
        "Stripe upgradeSubscription returned no url. Response keys:",
        Object.keys(res ?? {}),
      );
      throw new UserFacingError("Failed to get Stripe checkout URL");
    }
    return url;
  },
  { defaultErrorMessage: "Failed to get Stripe checkout URL" },
);

export const getStripeBillingPortalUrl = userOnlyAction(
  async function getStripeBillingPortalUrl(): Promise<string> {
    try {
      assertStripeConfigured();
    } catch (error) {
      console.error("Stripe configuration check failed:", error);
      throw new UserFacingError(
        "Stripe billing is not configured. Please contact support.",
      );
    }

    let returnUrl: string;
    try {
      returnUrl = `${publicAppUrl()}/settings/billing`;
    } catch (error) {
      console.error("Failed to resolve app URL:", error);
      throw new UserFacingError(
        "Application URL is not configured. Please contact support.",
      );
    }
    let res: { url?: string };
    try {
      res = await auth.api.createBillingPortal({
        body: {
          returnUrl,
          locale: "auto",
        },
        headers: await headers(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Stripe createBillingPortal failed:", message, error);
      throw new UserFacingError(
        `Failed to get Stripe billing portal URL: ${message}`,
      );
    }
    const url: string | undefined = res?.url;
    if (!url) {
      throw new UserFacingError("Failed to get Stripe billing portal URL");
    }
    return url;
  },
  { defaultErrorMessage: "Failed to get Stripe billing portal URL" },
);

export const setSignupTrialPlan = userOnlyAction(
  async function setSignupTrialPlan(userId: string, plan: AccessTier) {
    console.log("setSignupTrialPlan", userId, plan);
    await setSignupTrialPlanForUser({ db, userId, plan });
  },
  { defaultErrorMessage: "Failed to set signup trial plan" },
);
