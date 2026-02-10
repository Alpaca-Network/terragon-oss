import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  createTestUser,
  createTestThread,
  createTestGitHubPR,
} from "@terragon/shared/model/test-helpers";
import { grantUserCredits } from "@terragon/shared/model/credits";
import { trackUsageEventBatched } from "@terragon/shared/model/usage-events";
import { getInsightsData } from "./cli-router";

// Mock the broadcast server to prevent actual broadcast calls
vi.mock("@terragon/shared/broadcast-server", () => ({
  publishBroadcastUserMessage: vi.fn(),
}));

describe("CLI Router - Insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns insights data for a user with no activity", async () => {
    const { user } = await createTestUser({ db });

    const result = await getInsightsData({
      userId: user.id,
      numDays: 7,
      timezone: "UTC",
    });

    expect(result).toMatchObject({
      totalThreadsCreated: 0,
      totalPRsMerged: 0,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        cacheCreationInputTokens: 0,
      },
      costBreakdown: {
        anthropic: 0,
        openai: 0,
        google: 0,
        openrouter: 0,
        total: 0,
      },
      creditBalance: expect.objectContaining({
        totalCreditsCents: expect.any(Number),
        totalUsageCents: expect.any(Number),
        balanceCents: expect.any(Number),
      }),
      dailyStats: expect.any(Array),
    });

    // Should have 7 days of stats
    expect(result.dailyStats.length).toBe(7);
  });

  it("returns correct thread count for activity within the period", async () => {
    const { user } = await createTestUser({ db });

    // Create 3 threads for this user
    await createTestThread({ db, userId: user.id });
    await createTestThread({ db, userId: user.id });
    await createTestThread({ db, userId: user.id });

    const result = await getInsightsData({
      userId: user.id,
      numDays: 7,
      timezone: "UTC",
    });

    expect(result.totalThreadsCreated).toBe(3);
  });

  it("returns credit balance information", async () => {
    const { user } = await createTestUser({ db });

    // Grant some credits to the user
    await grantUserCredits({
      db,
      grants: {
        userId: user.id,
        amountCents: 5000, // $50
        description: "Test credits",
        grantType: "admin_adjustment",
      },
    });

    const result = await getInsightsData({
      userId: user.id,
      numDays: 7,
      timezone: "UTC",
    });

    expect(result.creditBalance.totalCreditsCents).toBe(5000);
    expect(result.creditBalance.balanceCents).toBe(5000);
  });

  it("returns usage token counts", async () => {
    const { user } = await createTestUser({ db });

    // Track some usage events
    await trackUsageEventBatched({
      db,
      userId: user.id,
      events: [
        {
          eventType: "billable_anthropic_usd",
          value: 1.5, // $1.50
          sku: "anthropic_messages_sonnet",
          tokenUsage: {
            inputTokens: 10000,
            outputTokens: 5000,
            cachedInputTokens: 2000,
            cacheCreationInputTokens: 500,
          },
        },
      ],
    });

    const result = await getInsightsData({
      userId: user.id,
      numDays: 7,
      timezone: "UTC",
    });

    expect(result.tokenUsage.inputTokens).toBe(10000);
    expect(result.tokenUsage.outputTokens).toBe(5000);
    expect(result.tokenUsage.cachedInputTokens).toBe(2000);
    expect(result.tokenUsage.cacheCreationInputTokens).toBe(500);
  });

  it("returns cost breakdown by provider", async () => {
    const { user } = await createTestUser({ db });

    // Track usage events for different providers
    await trackUsageEventBatched({
      db,
      userId: user.id,
      events: [
        {
          eventType: "billable_anthropic_usd",
          value: 2.0,
          sku: "anthropic_messages_sonnet",
          tokenUsage: {
            inputTokens: 1000,
            outputTokens: 500,
          },
        },
        {
          eventType: "billable_openai_usd",
          value: 1.0,
          sku: "openai_responses_gpt_5",
          tokenUsage: {
            inputTokens: 500,
            outputTokens: 250,
          },
        },
      ],
    });

    const result = await getInsightsData({
      userId: user.id,
      numDays: 7,
      timezone: "UTC",
    });

    expect(result.costBreakdown.anthropic).toBe(200); // $2.00 = 200 cents
    expect(result.costBreakdown.openai).toBe(100); // $1.00 = 100 cents
    expect(result.costBreakdown.total).toBe(300);
  });

  it("respects the numDays parameter", async () => {
    const { user } = await createTestUser({ db });

    const result = await getInsightsData({
      userId: user.id,
      numDays: 30,
      timezone: "UTC",
    });

    // Should have 30 days of stats
    expect(result.dailyStats.length).toBe(30);
  });

  it("returns merged PR count when PRs exist", async () => {
    const { user } = await createTestUser({ db });

    // Create a thread with a linked PR
    await createTestThread({
      db,
      userId: user.id,
      overrides: {
        githubPRNumber: 123,
        githubRepoFullName: "terragon/test-repo",
      },
    });

    // Create a merged PR linked to this thread
    await createTestGitHubPR({
      db,
      overrides: {
        number: 123,
        repoFullName: "terragon/test-repo",
        status: "merged",
      },
    });

    const result = await getInsightsData({
      userId: user.id,
      numDays: 7,
      timezone: "UTC",
    });

    expect(result.totalPRsMerged).toBe(1);
  });
});
