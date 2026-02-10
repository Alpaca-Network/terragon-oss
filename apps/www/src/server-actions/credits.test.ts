import { beforeEach, describe, expect, it, MockInstance, vi } from "vitest";
import { db } from "@/lib/db";
import { createTestUser } from "@terragon/shared/model/test-helpers";
import { mockLoggedInUser } from "@/test-helpers/mock-next";
import * as stripeConfig from "@/server-lib/stripe";
import { CREDIT_TOP_UP_REASON } from "@/server-lib/stripe-credit-top-ups";
import * as stripeHelpers from "@/server-lib/stripe-helpers";
import {
  createCreditTopUpCheckoutSession,
  createManagePaymentsSession,
} from "./credits";
import { getUser, updateUser } from "@terragon/shared/model/user";

// Helper to create a mock Stripe error (mimics Stripe SDK error structure)
function createMockStripeError(
  code: string,
  type: string,
): Error & { code?: string; type?: string } {
  const error = new Error(
    "Some internal message that should not be exposed",
  ) as Error & { code?: string; type?: string };
  error.name = "StripeInvalidRequestError";
  error.code = code;
  error.type = type;
  return error;
}

describe("createCreditTopUpCheckoutSession", () => {
  let stripeCheckoutSessionsCreateSpy: MockInstance<
    typeof stripeConfig.stripeCheckoutSessionsCreate
  >;
  let stripeCustomersCreateSpy: MockInstance<
    typeof stripeConfig.stripeCustomersCreate
  >;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    stripeCheckoutSessionsCreateSpy = vi
      .spyOn(stripeConfig, "stripeCheckoutSessionsCreate")
      .mockResolvedValue({
        id: "cs_test_123",
        url: "https://stripe.test/session/cs_test_123",
      } as any);
    stripeCustomersCreateSpy = vi
      .spyOn(stripeConfig, "stripeCustomersCreate")
      .mockResolvedValue({
        id: "cus_existing_123",
        email: "test@terragon.com",
        name: "Test User",
      } as any);
  });

  it("throws when credit top ups are not configured", async () => {
    const { session } = await createTestUser({
      db,
      skipBillingFeatureFlag: true,
    });
    await mockLoggedInUser(session);
    vi.spyOn(
      stripeConfig,
      "assertStripeConfiguredForCredits",
    ).mockImplementation(() => {
      throw new Error("Stripe is not configured for credits");
    });
    const result = await createCreditTopUpCheckoutSession();
    expect(result.errorMessage).toBe(
      "Failed to create Stripe checkout session",
    );
    expect(stripeCheckoutSessionsCreateSpy).not.toHaveBeenCalled();
    expect(stripeCustomersCreateSpy).not.toHaveBeenCalled();
  });

  it("reuses an existing Stripe customer id for the user", async () => {
    const { user, session } = await createTestUser({
      db,
      skipBillingFeatureFlag: true,
    });
    await updateUser({
      db,
      userId: user.id,
      updates: { stripeCustomerId: "cus_existing_123" },
    });

    await mockLoggedInUser(session);
    const result = await createCreditTopUpCheckoutSession();
    expect(result.success).toBe(true);
    const checkoutUrl = result.data;
    expect(checkoutUrl).toBe("https://stripe.test/session/cs_test_123");
    expect(stripeCustomersCreateSpy).not.toHaveBeenCalled();
    expect(stripeCheckoutSessionsCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing_123",
        metadata: expect.objectContaining({
          terragon_user_id: user.id,
          reason: CREDIT_TOP_UP_REASON,
        }),
        payment_intent_data: expect.objectContaining({
          metadata: expect.objectContaining({
            terragon_user_id: user.id,
            reason: CREDIT_TOP_UP_REASON,
          }),
        }),
      }),
    );
  });

  it("creates a Stripe customer when one does not exist", async () => {
    const { user, session } = await createTestUser({
      db,
      skipBillingFeatureFlag: true,
    });
    stripeCustomersCreateSpy.mockResolvedValueOnce({
      id: "cus_new_123",
      email: user.email,
      name: user.name,
    } as any);

    await mockLoggedInUser(session);
    const result = await createCreditTopUpCheckoutSession();
    expect(result.success).toBe(true);
    const checkoutUrl = result.data;
    expect(checkoutUrl).toBe("https://stripe.test/session/cs_test_123");
    expect(stripeCustomersCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: user.email,
        name: user.name,
        metadata: {
          terragon_user_id: user.id,
        },
      }),
    );
    expect(stripeCheckoutSessionsCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_new_123",
      }),
    );
    const updatedUser = await getUser({ db, userId: user.id });
    expect(updatedUser?.stripeCustomerId).toBe("cus_new_123");
  });

  it("returns sanitized error message when ensureStripeCustomer fails with regular error", async () => {
    const { session } = await createTestUser({
      db,
      skipBillingFeatureFlag: true,
    });
    await mockLoggedInUser(session);
    // Regular errors should be sanitized to avoid information disclosure
    vi.spyOn(stripeHelpers, "ensureStripeCustomer").mockRejectedValue(
      new Error("Invalid API key: sk_test_xxx"),
    );
    const result = await createCreditTopUpCheckoutSession();
    expect(result.success).toBe(false);
    // Should NOT expose the raw error message with API key
    expect(result.errorMessage).toBe(
      "Failed to create Stripe checkout session: An unexpected error occurred",
    );
    expect(stripeCheckoutSessionsCreateSpy).not.toHaveBeenCalled();
  });

  it("surfaces safe Stripe error code when stripeCheckoutSessionsCreate fails with StripeError", async () => {
    const { user, session } = await createTestUser({
      db,
      skipBillingFeatureFlag: true,
    });
    await updateUser({
      db,
      userId: user.id,
      updates: { stripeCustomerId: "cus_existing_123" },
    });
    await mockLoggedInUser(session);
    // Stripe errors should expose only the safe error code
    stripeCheckoutSessionsCreateSpy.mockRejectedValue(
      createMockStripeError("resource_missing", "invalid_request_error"),
    );
    const result = await createCreditTopUpCheckoutSession();
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe(
      "Failed to create Stripe checkout session: Stripe error: resource_missing",
    );
  });
});

describe("createManagePaymentsSession", () => {
  let billingPortalSessionsCreateSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    const mockStripeClient = {
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            url: "https://stripe.test/portal/session_123",
          }),
        },
      },
    };
    vi.spyOn(stripeConfig, "getStripeClient").mockReturnValue(
      mockStripeClient as any,
    );
    billingPortalSessionsCreateSpy =
      mockStripeClient.billingPortal.sessions.create;
    vi.spyOn(stripeConfig, "stripeCustomersCreate").mockResolvedValue({
      id: "cus_new_123",
      email: "test@terragon.com",
      name: "Test User",
    } as any);
  });

  it("creates a billing portal session successfully", async () => {
    const { user, session } = await createTestUser({
      db,
      skipBillingFeatureFlag: true,
    });
    await updateUser({
      db,
      userId: user.id,
      updates: { stripeCustomerId: "cus_existing_123" },
    });
    await mockLoggedInUser(session);
    const result = await createManagePaymentsSession();
    expect(result.success).toBe(true);
    expect(result.data).toBe("https://stripe.test/portal/session_123");
    expect(billingPortalSessionsCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing_123",
      }),
    );
  });

  it("returns sanitized error message when ensureStripeCustomer fails with regular error", async () => {
    const { session } = await createTestUser({
      db,
      skipBillingFeatureFlag: true,
    });
    await mockLoggedInUser(session);
    // Regular errors should be sanitized to avoid information disclosure
    vi.spyOn(stripeHelpers, "ensureStripeCustomer").mockRejectedValue(
      new Error("Connection string: postgres://user:password@host"),
    );
    const result = await createManagePaymentsSession();
    expect(result.success).toBe(false);
    // Should NOT expose the raw error message with sensitive info
    expect(result.errorMessage).toBe(
      "Failed to create Stripe billing portal session: An unexpected error occurred",
    );
    expect(billingPortalSessionsCreateSpy).not.toHaveBeenCalled();
  });

  it("surfaces safe Stripe error code when billingPortal.sessions.create fails with StripeError", async () => {
    const { user, session } = await createTestUser({
      db,
      skipBillingFeatureFlag: true,
    });
    await updateUser({
      db,
      userId: user.id,
      updates: { stripeCustomerId: "cus_existing_123" },
    });
    await mockLoggedInUser(session);
    // Stripe errors should expose only the safe error code
    billingPortalSessionsCreateSpy.mockRejectedValue(
      createMockStripeError("resource_missing", "invalid_request_error"),
    );
    const result = await createManagePaymentsSession();
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe(
      "Failed to create Stripe billing portal session: Stripe error: resource_missing",
    );
  });

  it("throws error when billing portal session has no URL", async () => {
    const { user, session } = await createTestUser({
      db,
      skipBillingFeatureFlag: true,
    });
    await updateUser({
      db,
      userId: user.id,
      updates: { stripeCustomerId: "cus_existing_123" },
    });
    await mockLoggedInUser(session);
    // Simulate session returned without URL (edge case)
    billingPortalSessionsCreateSpy.mockResolvedValue({
      id: "bps_test_123",
      url: null,
    });
    const result = await createManagePaymentsSession();
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe(
      "Failed to create Stripe billing portal session",
    );
  });
});
