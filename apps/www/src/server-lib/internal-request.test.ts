import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Unmock internal-request so we can test the actual implementation
vi.unmock("@/server-lib/internal-request");

// Mock the env module before importing the module under test
vi.mock("@terragon/env/apps-www", () => ({
  env: {
    IS_ANTHROPIC_DOWN_URL: "https://health.example.com",
    IS_ANTHROPIC_DOWN_API_SECRET: "test-api-secret",
    INTERNAL_SHARED_SECRET: "test-internal-secret",
  },
}));

// Mock next-public for internalPOST
vi.mock("@terragon/env/next-public", () => ({
  publicAppUrl: () => "http://localhost:3000",
}));

// Store original fetch
const originalFetch = global.fetch;

describe("isAnthropicAvailable", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let isAnthropicAvailable: (skipCache?: boolean) => Promise<{
    available: boolean;
    status?: "healthy" | "degraded" | "down";
    message?: string;
    checkedAt: number;
  }>;
  let clearAnthropicHealthCache: () => void;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a fresh mock for each test
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Re-import the module to get fresh state and pick up the mocked fetch
    vi.resetModules();
    const module = await import("./internal-request");
    isAnthropicAvailable = module.isAnthropicAvailable;
    clearAnthropicHealthCache = module.clearAnthropicHealthCache;

    // Clear any cached state
    clearAnthropicHealthCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("returns healthy status when health service responds with available: true", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        available: true,
        status: "healthy",
        message: "All systems operational",
      }),
    });

    const result = await isAnthropicAvailable();

    expect(result).toMatchObject({
      available: true,
      status: "healthy",
      message: "All systems operational",
    });
    expect(result.checkedAt).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://health.example.com/api/health/status",
      {
        method: "GET",
        headers: {
          Authorization: "test-api-secret",
          "Content-Type": "application/json",
        },
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("returns degraded status when health service reports degraded", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        available: true,
        status: "degraded",
        message: "High latency detected",
      }),
    });

    const result = await isAnthropicAvailable();

    expect(result).toMatchObject({
      available: true,
      status: "degraded",
      message: "High latency detected",
    });
  });

  it("returns down status when health service reports down", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        available: false,
        status: "down",
        message: "Anthropic API is experiencing an outage",
      }),
    });

    const result = await isAnthropicAvailable();

    expect(result).toMatchObject({
      available: false,
      status: "down",
      message: "Anthropic API is experiencing an outage",
    });
  });

  it("fails open when health service returns non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await isAnthropicAvailable();

    expect(result).toMatchObject({
      available: true,
      status: "healthy",
      message: "Health service unavailable, assuming available",
    });
  });

  it("fails open when health service throws an error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await isAnthropicAvailable();

    expect(result).toMatchObject({
      available: true,
      status: "healthy",
      message: "Health check failed, assuming available",
    });
  });

  it("returns cached result within TTL", async () => {
    vi.useFakeTimers();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        available: true,
        status: "healthy",
      }),
    });

    // First call - should fetch
    await isAnthropicAvailable();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance time by 10 seconds (within 30s TTL)
    vi.advanceTimersByTime(10_000);

    // Second call - should use cache
    const result = await isAnthropicAvailable();
    expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
    expect(result.available).toBe(true);
  });

  it("fetches fresh status after TTL expires", async () => {
    vi.useFakeTimers();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: true,
          status: "healthy",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: false,
          status: "down",
        }),
      });

    // First call
    const result1 = await isAnthropicAvailable();
    expect(result1.available).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance time by 31 seconds (past 30s TTL)
    vi.advanceTimersByTime(31_000);

    // Second call - should fetch fresh
    const result2 = await isAnthropicAvailable();
    expect(result2.available).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("bypasses cache when skipCache is true", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: true,
          status: "healthy",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: false,
          status: "down",
        }),
      });

    // First call
    const result1 = await isAnthropicAvailable();
    expect(result1.available).toBe(true);

    // Second call with skipCache - should fetch again
    const result2 = await isAnthropicAvailable(true);
    expect(result2.available).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles missing fields in response gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // Empty response
    });

    const result = await isAnthropicAvailable();

    // Should default to available when not specified
    expect(result).toMatchObject({
      available: true,
      status: "healthy",
    });
  });

  it("handles partial response fields", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        available: false,
        // No status or message
      }),
    });

    const result = await isAnthropicAvailable();

    expect(result).toMatchObject({
      available: false,
      status: "healthy", // Defaults to healthy
    });
  });
});

describe("clearAnthropicHealthCache", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let isAnthropicAvailable: (skipCache?: boolean) => Promise<{
    available: boolean;
    status?: "healthy" | "degraded" | "down";
    message?: string;
    checkedAt: number;
  }>;
  let clearAnthropicHealthCache: () => void;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a fresh mock for each test
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Re-import the module to get fresh state
    vi.resetModules();
    const module = await import("./internal-request");
    isAnthropicAvailable = module.isAnthropicAvailable;
    clearAnthropicHealthCache = module.clearAnthropicHealthCache;

    clearAnthropicHealthCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("clears the cached status", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        available: true,
        status: "healthy",
      }),
    });

    // First call - populates cache
    await isAnthropicAvailable();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call - uses cache
    await isAnthropicAvailable();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Clear cache
    clearAnthropicHealthCache();

    // Third call - should fetch again
    await isAnthropicAvailable();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
