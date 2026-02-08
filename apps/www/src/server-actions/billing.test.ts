import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- vi.mock calls (hoisted to top) ----

// Mock auth-server to bypass session/user checks and replicate the
// real UserFacingError / wrapServerAction behavior.
vi.mock("@/lib/auth-server", () => {
  function wrapServerActionInternal(
    callback: (...args: any[]) => Promise<any>,
    options: { defaultErrorMessage: string },
  ) {
    return async (...args: any[]) => {
      try {
        const data = await callback(...args);
        return { success: true, data };
      } catch (error: any) {
        const errorMessage =
          error?.name === "UserFacingError"
            ? error.message
            : options.defaultErrorMessage;
        return { success: false, errorMessage };
      }
    };
  }

  return {
    userOnlyAction: vi.fn(
      (
        fn: (userId: string, ...args: any[]) => Promise<any>,
        options: { defaultErrorMessage: string },
      ) => {
        const wrapped = async (...args: any[]) => {
          return fn("test-user-id", ...args);
        };
        return wrapServerActionInternal(wrapped, options);
      },
    ),
  };
});

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      upgradeSubscription: vi.fn(),
      createBillingPortal: vi.fn(),
    },
  },
}));

vi.mock("@terragon/shared/model/subscription", () => ({
  getSubscriptionInfoForUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@terragon/shared/model/feature-flags", () => ({
  getFeatureFlagsGlobal: vi.fn().mockResolvedValue({ shutdownMode: false }),
}));

vi.mock("@/lib/db", () => ({ db: {} }));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/server-lib/stripe", () => ({
  assertStripeConfigured: vi.fn(),
}));

vi.mock("@terragon/env/next-public", () => ({
  publicAppUrl: vi.fn(() => "http://localhost:3000"),
}));

// ---- imports (after mocks) ----
import { auth } from "@/lib/auth";
import { getSubscriptionInfoForUser } from "@terragon/shared/model/subscription";
import { getFeatureFlagsGlobal } from "@terragon/shared/model/feature-flags";
import { assertStripeConfigured } from "@/server-lib/stripe";
import { publicAppUrl } from "@terragon/env/next-public";
import { getStripeCheckoutUrl, getStripeBillingPortalUrl } from "./billing";

describe("getStripeCheckoutUrl", () => {
  const upgradeSubscriptionMock = vi.mocked(auth.api.upgradeSubscription);
  const getFeatureFlagsMock = vi.mocked(getFeatureFlagsGlobal);
  const getSubscriptionMock = vi.mocked(getSubscriptionInfoForUser);

  beforeEach(() => {
    vi.restoreAllMocks();
    getSubscriptionMock.mockResolvedValue(null);
    getFeatureFlagsMock.mockResolvedValue({ shutdownMode: false } as any);
    upgradeSubscriptionMock.mockReset();
  });

  it("returns checkout URL when upgradeSubscription succeeds", async () => {
    upgradeSubscriptionMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123",
      redirect: false,
    } as any);

    const result = await getStripeCheckoutUrl({ plan: "core" });
    expect(result.success).toBe(true);
    expect(result.data).toBe("https://checkout.stripe.com/pay/cs_test_123");
  });

  it("surfaces the actual error message when upgradeSubscription throws", async () => {
    upgradeSubscriptionMock.mockRejectedValue(
      new Error("Subscription plan not found"),
    );

    const result = await getStripeCheckoutUrl({ plan: "core" });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("Subscription plan not found");
  });

  it("returns error when response has no url", async () => {
    upgradeSubscriptionMock.mockResolvedValue({
      id: "cs_test_123",
      redirect: false,
      // url is missing
    } as any);

    const result = await getStripeCheckoutUrl({ plan: "core" });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Failed to get Stripe checkout URL");
  });

  it("surfaces the actual error when Stripe is not configured", async () => {
    vi.mocked(assertStripeConfigured).mockImplementation(() => {
      throw new Error("Stripe is not configured");
    });

    const result = await getStripeCheckoutUrl({ plan: "core" });
    expect(result.success).toBe(false);
    // After fix: assertStripeConfigured error is wrapped in UserFacingError
    expect(result.errorMessage).toContain("Stripe billing is not configured");
  });

  it("surfaces a user-friendly error when publicAppUrl throws", async () => {
    vi.mocked(publicAppUrl).mockImplementation(() => {
      throw new Error("NEXT_PUBLIC_APP_URL is not set");
    });

    const result = await getStripeCheckoutUrl({ plan: "core" });
    expect(result.success).toBe(false);
    // After fix: publicAppUrl error is wrapped with user-friendly message (no internal env var names)
    expect(result.errorMessage).toContain("Application URL is not configured");
  });

  it("shows shutdown message when shutdown mode is enabled", async () => {
    getFeatureFlagsMock.mockResolvedValue({ shutdownMode: true } as any);

    const result = await getStripeCheckoutUrl({ plan: "core" });
    expect(result.success).toBe(false);
    // shutdownMode throws a UserFacingError so the message IS surfaced
    expect(result.errorMessage).toContain("shutting down");
  });
});

describe("getStripeBillingPortalUrl", () => {
  const createBillingPortalMock = vi.mocked(auth.api.createBillingPortal);

  beforeEach(() => {
    vi.restoreAllMocks();
    createBillingPortalMock.mockReset();
  });

  it("returns billing portal URL when createBillingPortal succeeds", async () => {
    createBillingPortalMock.mockResolvedValue({
      url: "https://billing.stripe.com/session/test_123",
    } as any);

    const result = await getStripeBillingPortalUrl();
    expect(result.success).toBe(true);
    expect(result.data).toBe("https://billing.stripe.com/session/test_123");
  });

  it("surfaces the actual error when Stripe is not configured", async () => {
    vi.mocked(assertStripeConfigured).mockImplementation(() => {
      throw new Error("Stripe is not configured");
    });

    const result = await getStripeBillingPortalUrl();
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("Stripe billing is not configured");
  });

  it("surfaces a user-friendly error when publicAppUrl throws", async () => {
    vi.mocked(publicAppUrl).mockImplementation(() => {
      throw new Error("NEXT_PUBLIC_APP_URL is not set");
    });

    const result = await getStripeBillingPortalUrl();
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("Application URL is not configured");
  });

  it("surfaces the actual error when createBillingPortal throws", async () => {
    createBillingPortalMock.mockRejectedValue(new Error("Customer not found"));

    const result = await getStripeBillingPortalUrl();
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("Customer not found");
  });

  it("returns error when response has no url", async () => {
    createBillingPortalMock.mockResolvedValue({} as any);

    const result = await getStripeBillingPortalUrl();
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Failed to get Stripe billing portal URL");
  });
});
