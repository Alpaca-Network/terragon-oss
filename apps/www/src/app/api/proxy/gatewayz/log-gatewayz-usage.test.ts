import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  logGatewayZUsage,
  getGatewayZUsageSummary,
} from "./log-gatewayz-usage";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
  },
}));

describe("logGatewayZUsage", () => {
  const dbInsertMock = vi.mocked(db.insert);

  beforeEach(() => {
    vi.clearAllMocks();
    dbInsertMock.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as any);
  });

  it("should log usage to database when userId and usage are provided", async () => {
    await logGatewayZUsage({
      path: "/v1/chat/completions",
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
      userId: "user-123",
      model: "gpt-4",
      provider: "openai",
    });

    expect(dbInsertMock).toHaveBeenCalled();
  });

  it("should not log when userId is missing", async () => {
    await logGatewayZUsage({
      path: "/v1/chat/completions",
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
      },
      model: "gpt-4",
    });

    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it("should not log when usage is null", async () => {
    await logGatewayZUsage({
      path: "/v1/chat/completions",
      usage: null,
      userId: "user-123",
      model: "gpt-4",
    });

    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it("should not log when totalTokens is zero", async () => {
    await logGatewayZUsage({
      path: "/v1/chat/completions",
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      userId: "user-123",
      model: "gpt-4",
    });

    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it("should handle negative token values by treating them as zero", async () => {
    await logGatewayZUsage({
      path: "/v1/chat/completions",
      usage: {
        prompt_tokens: -100,
        completion_tokens: -50,
      },
      userId: "user-123",
      model: "gpt-4",
    });

    // Negative values are converted to 0, so totalTokens becomes 0 and nothing is logged
    expect(dbInsertMock).not.toHaveBeenCalled();
  });
});

describe("getGatewayZUsageSummary", () => {
  const dbSelectMock = vi.mocked(db.select);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return aggregated usage summary", async () => {
    // Mock the totals query
    const mockTotals = {
      totalInputTokens: 5000,
      totalOutputTokens: 2500,
      requestCount: 10,
    };

    // Mock the by-provider query
    const mockByProvider = [
      {
        provider: "anthropic",
        inputTokens: 3000,
        outputTokens: 1500,
        requestCount: 6,
      },
      {
        provider: "openai",
        inputTokens: 2000,
        outputTokens: 1000,
        requestCount: 4,
      },
    ];

    // Mock the by-model query
    const mockByModel = [
      {
        model: "claude-3-5-sonnet",
        inputTokens: 3000,
        outputTokens: 1500,
        requestCount: 6,
      },
      {
        model: "gpt-4",
        inputTokens: 2000,
        outputTokens: 1000,
        requestCount: 4,
      },
    ];

    let callCount = 0;
    dbSelectMock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Totals query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockTotals]),
          }),
        } as any;
      } else if (callCount === 2) {
        // By provider query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockByProvider),
            }),
          }),
        } as any;
      } else {
        // By model query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue(mockByModel),
            }),
          }),
        } as any;
      }
    });

    const result = await getGatewayZUsageSummary({
      userId: "user-123",
    });

    expect(result.userId).toBe("user-123");
    expect(result.totalInputTokens).toBe(5000);
    expect(result.totalOutputTokens).toBe(2500);
    expect(result.totalTokens).toBe(7500);
    expect(result.requestCount).toBe(10);
    expect(result.byProvider).toEqual({
      anthropic: { inputTokens: 3000, outputTokens: 1500, requestCount: 6 },
      openai: { inputTokens: 2000, outputTokens: 1000, requestCount: 4 },
    });
    expect(result.byModel).toEqual({
      "claude-3-5-sonnet": {
        inputTokens: 3000,
        outputTokens: 1500,
        requestCount: 6,
      },
      "gpt-4": { inputTokens: 2000, outputTokens: 1000, requestCount: 4 },
    });
  });

  it("should handle empty results", async () => {
    dbSelectMock.mockImplementation(
      () =>
        ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }) as any,
    );

    // Override for totals query which doesn't have groupBy
    let callCount = 0;
    dbSelectMock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([undefined]),
          }),
        } as any;
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any;
    });

    const result = await getGatewayZUsageSummary({
      userId: "user-no-usage",
    });

    expect(result.totalInputTokens).toBe(0);
    expect(result.totalOutputTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
    expect(result.requestCount).toBe(0);
    expect(result.byProvider).toEqual({});
    expect(result.byModel).toEqual({});
  });

  it("should pass date filters correctly", async () => {
    const startDate = new Date("2025-01-01");
    const endDate = new Date("2025-01-31");

    dbSelectMock.mockImplementation(
      () =>
        ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }) as any,
    );

    // Override for totals query
    let callCount = 0;
    dbSelectMock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                totalInputTokens: 0,
                totalOutputTokens: 0,
                requestCount: 0,
              },
            ]),
          }),
        } as any;
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any;
    });

    const result = await getGatewayZUsageSummary({
      userId: "user-123",
      startDate,
      endDate,
    });

    expect(result.startDate).toEqual(startDate);
    expect(result.endDate).toEqual(endDate);
    expect(dbSelectMock).toHaveBeenCalled();
  });
});
