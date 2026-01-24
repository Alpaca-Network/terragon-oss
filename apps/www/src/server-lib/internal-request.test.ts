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
    down: boolean;
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

  it("returns down: false when health service responds with down: false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ down: false }),
    });

    const result = await isAnthropicAvailable();

    expect(result).toMatchObject({ down: false });
    expect(result.checkedAt).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledWith("https://health.example.com", {
      method: "GET",
      headers: {
        Authorization: "test-api-secret",
      },
      signal: expect.any(AbortSignal),
    });
  });

  it("returns down: true when health service reports Anthropic is down", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ down: true }),
    });

    const result = await isAnthropicAvailable();

    expect(result).toMatchObject({ down: true });
  });

  it("fails open (down: false) when health service returns non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await isAnthropicAvailable();

    expect(result).toMatchObject({ down: false });
  });

  it("fails open (down: false) when health service throws an error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await isAnthropicAvailable();

    expect(result).toMatchObject({ down: false });
  });

  it("returns cached result within TTL", async () => {
    vi.useFakeTimers();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ down: false }),
    });

    // First call - should fetch
    await isAnthropicAvailable();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance time by 10 seconds (within 30s TTL)
    vi.advanceTimersByTime(10_000);

    // Second call - should use cache
    const result = await isAnthropicAvailable();
    expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
    expect(result.down).toBe(false);
  });

  it("fetches fresh status after TTL expires", async () => {
    vi.useFakeTimers();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ down: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ down: true }),
      });

    // First call
    const result1 = await isAnthropicAvailable();
    expect(result1.down).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance time by 31 seconds (past 30s TTL)
    vi.advanceTimersByTime(31_000);

    // Second call - should fetch fresh
    const result2 = await isAnthropicAvailable();
    expect(result2.down).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("bypasses cache when skipCache is true", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ down: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ down: true }),
      });

    // First call
    const result1 = await isAnthropicAvailable();
    expect(result1.down).toBe(false);

    // Second call with skipCache - should fetch again
    const result2 = await isAnthropicAvailable(true);
    expect(result2.down).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("defaults to down: false when response has no down field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // Empty response
    });

    const result = await isAnthropicAvailable();

    expect(result).toMatchObject({ down: false });
  });
});

describe("clearAnthropicHealthCache", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let isAnthropicAvailable: (skipCache?: boolean) => Promise<{
    down: boolean;
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
      json: async () => ({ down: false }),
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
