import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

// Mock NextResponse
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return {
    ...actual,
    NextResponse: {
      redirect: vi.fn((url, options) => ({
        type: "redirect",
        url: url.toString(),
        headers: options?.headers || new Headers(),
        cookies: {
          set: vi.fn(),
        },
      })),
      next: vi.fn((options) => ({
        type: "next",
        request: options?.request,
        headers: new Headers(),
        cookies: {
          set: vi.fn(),
        },
      })),
    },
  };
});

function createMockRequest(
  url: string,
  options: {
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const requestUrl = new URL(url, "https://terragon.ai");
  const headers = new Headers(options.headers || {});

  // Create a mock cookies object
  const cookiesMap = new Map<string, { value: string }>();
  if (options.cookies) {
    Object.entries(options.cookies).forEach(([key, value]) => {
      cookiesMap.set(key, { value });
    });
  }

  return {
    url: requestUrl.toString(),
    headers,
    cookies: {
      get: (name: string) => cookiesMap.get(name),
      has: (name: string) => cookiesMap.has(name),
    },
  } as unknown as NextRequest;
}

describe("middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("GatewayZ session token forwarding", () => {
    it("should forward gw_session_token as Authorization header", async () => {
      const sessionToken = "test-session-token-123";
      const request = createMockRequest("/dashboard", {
        cookies: {
          gw_session_token: sessionToken,
        },
      });

      const response = middleware(request);

      // Check that the response forwards the request with Authorization header
      expect(response.type).toBe("next");
      expect(response.request?.headers.get("Authorization")).toBe(
        `Bearer ${sessionToken}`,
      );
    });

    it("should not forward token if better-auth.session_token cookie exists", async () => {
      const sessionToken = "test-session-token-123";
      const request = createMockRequest("/dashboard", {
        cookies: {
          gw_session_token: sessionToken,
          "better-auth.session_token": "signed-cookie-value",
        },
      });

      const response = middleware(request);

      // Check that normal next() is called without header modification
      expect(response.type).toBe("next");
      expect(response.request).toBeUndefined();
    });

    it("should not redirect to GatewayZ if gw_session_token exists", async () => {
      process.env.NEXT_PUBLIC_GATEWAYZ_URL = "https://beta.gatewayz.ai";

      const request = createMockRequest("/", {
        cookies: {
          gw_session_token: "test-session-token",
        },
      });

      const response = middleware(request);

      // Should not redirect to GatewayZ
      expect(response.type).toBe("next");
    });
  });

  describe("redirect prevention", () => {
    it("should redirect to GatewayZ on public entry points when no auth", async () => {
      process.env.NEXT_PUBLIC_GATEWAYZ_URL = "https://beta.gatewayz.ai";

      const request = createMockRequest("/");

      const response = middleware(request);

      expect(response.type).toBe("redirect");
      expect(response.url).toBe("https://beta.gatewayz.ai/inbox");
    });

    it("should not redirect when better-auth.session_token exists", async () => {
      process.env.NEXT_PUBLIC_GATEWAYZ_URL = "https://beta.gatewayz.ai";

      const request = createMockRequest("/", {
        cookies: {
          "better-auth.session_token": "some-token",
        },
      });

      const response = middleware(request);

      expect(response.type).toBe("next");
    });

    it("should not redirect on non-public entry points", async () => {
      process.env.NEXT_PUBLIC_GATEWAYZ_URL = "https://beta.gatewayz.ai";

      const request = createMockRequest("/dashboard");

      const response = middleware(request);

      expect(response.type).toBe("next");
    });

    it("should not redirect when embed mode cookie is set", async () => {
      process.env.NEXT_PUBLIC_GATEWAYZ_URL = "https://beta.gatewayz.ai";

      const request = createMockRequest("/", {
        cookies: {
          gw_embed_mode: "true",
        },
      });

      const response = middleware(request);

      expect(response.type).toBe("next");
    });
  });
});
