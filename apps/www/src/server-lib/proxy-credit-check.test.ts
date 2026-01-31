import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkProxyCredits } from "./proxy-credit-check";

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@terragon/shared/model/credits", () => ({
  getUserCreditBalance: vi.fn(),
}));

vi.mock("@/lib/subscription", () => ({
  getAccessInfoForUser: vi.fn(),
}));

vi.mock("./credit-auto-reload", () => ({
  maybeTriggerCreditAutoReload: vi.fn(),
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn(),
}));

import { getUserCreditBalance } from "@terragon/shared/model/credits";
import { getAccessInfoForUser } from "@/lib/subscription";

describe("checkProxyCredits", () => {
  const getUserCreditBalanceMock = vi.mocked(getUserCreditBalance);
  const getAccessInfoForUserMock = vi.mocked(getAccessInfoForUser);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows users with active subscription even with zero credits", async () => {
    getAccessInfoForUserMock.mockResolvedValue({ tier: "core" });
    getUserCreditBalanceMock.mockResolvedValue({
      totalCreditsCents: 0,
      totalUsageCents: 0,
      balanceCents: 0,
    });

    const result = await checkProxyCredits("user-123", "Anthropic");

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.userId).toBe("user-123");
      expect(result.balanceCents).toBe(0);
    }
  });

  it("allows users with positive credits and no subscription", async () => {
    getAccessInfoForUserMock.mockResolvedValue({ tier: "none" });
    getUserCreditBalanceMock.mockResolvedValue({
      totalCreditsCents: 1000,
      totalUsageCents: 0,
      balanceCents: 1000,
    });

    const result = await checkProxyCredits("user-123", "OpenAI");

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.userId).toBe("user-123");
      expect(result.balanceCents).toBe(1000);
    }
  });

  it("rejects users with no subscription and zero credits", async () => {
    getAccessInfoForUserMock.mockResolvedValue({ tier: "none" });
    getUserCreditBalanceMock.mockResolvedValue({
      totalCreditsCents: 0,
      totalUsageCents: 0,
      balanceCents: 0,
    });

    const result = await checkProxyCredits("user-123", "Google");

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.response.status).toBe(402);
    }
  });

  it("allows users on trial (signupTrial) with zero credits", async () => {
    // Trial users get a tier like "core" from getAccessInfoForUser
    getAccessInfoForUserMock.mockResolvedValue({ tier: "core" });
    getUserCreditBalanceMock.mockResolvedValue({
      totalCreditsCents: 0,
      totalUsageCents: 0,
      balanceCents: 0,
    });

    const result = await checkProxyCredits("user-123", "OpenRouter");

    expect(result.allowed).toBe(true);
  });

  it("allows users with pro subscription", async () => {
    getAccessInfoForUserMock.mockResolvedValue({ tier: "pro" });
    getUserCreditBalanceMock.mockResolvedValue({
      totalCreditsCents: 0,
      totalUsageCents: 0,
      balanceCents: 0,
    });

    const result = await checkProxyCredits("user-123", "Anthropic");

    expect(result.allowed).toBe(true);
  });
});
