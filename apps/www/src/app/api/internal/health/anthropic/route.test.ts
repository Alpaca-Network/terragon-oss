import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock the env module
vi.mock("@terragon/env/apps-www", () => ({
  env: {
    IS_ANTHROPIC_DOWN_API_SECRET: "test-api-secret",
    ANTHROPIC_API_KEY: "test-anthropic-key",
  },
}));

// Store original fetch
const originalFetch = global.fetch;

function createMockRequest(
  method: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/internal/health/anthropic",
    {
      method,
      headers,
    },
  );
}

describe("GET /api/internal/health/anthropic", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let GET: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Create a fresh mock for each test
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Re-import the module to get fresh state
    const module = await import("./route");
    GET = module.GET;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const request = createMockRequest("GET");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns 401 when Authorization header is incorrect", async () => {
    const request = createMockRequest("GET", {
      Authorization: "wrong-secret",
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns down: false when Anthropic API responds successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
    });

    const request = createMockRequest("GET", {
      Authorization: "test-api-secret",
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ down: false });
  });

  it("returns down: true when Anthropic API returns 5xx error", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      ok: false,
    });

    const request = createMockRequest("GET", {
      Authorization: "test-api-secret",
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ down: true });
  });

  it("returns down: true when Anthropic API request throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const request = createMockRequest("GET", {
      Authorization: "test-api-secret",
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ down: true });
  });

  it("returns cached result within TTL", async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
    });

    const request = createMockRequest("GET", {
      Authorization: "test-api-secret",
    });

    // First call
    await GET(request);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    await GET(request);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/internal/health/anthropic", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Create a fresh mock for each test
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Re-import the module to get fresh state
    const module = await import("./route");
    POST = module.POST;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const request = createMockRequest("POST");
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("bypasses cache and performs fresh check", async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
    });

    const request = createMockRequest("POST", {
      Authorization: "test-api-secret",
    });

    // First POST call
    await POST(request);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second POST call - should fetch again (bypasses cache)
    await POST(request);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("calls Anthropic API with correct parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
    });

    const request = createMockRequest("POST", {
      Authorization: "test-api-secret",
    });
    await POST(request);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-anthropic-key",
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
