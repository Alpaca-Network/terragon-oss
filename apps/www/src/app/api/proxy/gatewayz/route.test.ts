import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import * as gatewayZRoute from "./[[...path]]/route";
import { logGatewayZUsage } from "./log-gatewayz-usage";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      verifyApiKey: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ gwTier: "pro" }]),
  },
}));

vi.mock("@terragon/env/apps-www", () => ({
  env: {
    GATEWAYZ_API_KEY: "test-gatewayz-key",
  },
}));

vi.mock("./log-gatewayz-usage", () => ({
  logGatewayZUsage: vi.fn(),
}));

const encoder = new TextEncoder();
const VALID_MODEL = "claude-3-5-sonnet-20241022";

function createRequest({
  method = "POST",
  headers = {},
  body,
  url = "https://example.com/api/proxy/gatewayz",
  includeDefaultToken = true,
}: {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  url?: string;
  includeDefaultToken?: boolean;
} = {}): NextRequest {
  const mergedHeaders = new Headers(headers);

  const hasDaemonToken =
    mergedHeaders.has("X-Daemon-Token") ||
    /^x-daemon-token\s+/i.test(mergedHeaders.get("authorization") ?? "");

  if (includeDefaultToken && !hasDaemonToken) {
    mergedHeaders.set("X-Daemon-Token", "test-daemon-token");
  }

  const arrayBuffer =
    body === undefined
      ? vi.fn().mockResolvedValue(new ArrayBuffer(0))
      : vi.fn().mockResolvedValue(encoder.encode(JSON.stringify(body)).buffer);

  const mockRequest = {
    method,
    headers: mergedHeaders,
    nextUrl: new URL(url),
    arrayBuffer,
    clone() {
      return mockRequest;
    },
  } as unknown as NextRequest;

  return mockRequest;
}

describe("Gatewayz proxy route", () => {
  const verifyApiKeyMock = vi.mocked(auth.api.verifyApiKey);
  const dbSelectMock = vi.mocked(db.select);
  const logUsageMock = vi.mocked(logGatewayZUsage);
  const { POST } = gatewayZRoute;

  beforeEach(async () => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    verifyApiKeyMock.mockResolvedValue({
      valid: true,
      error: null,
      key: { userId: "user-123" } as any,
    });
    // Reset the chain mock for db.select
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ gwTier: "pro" }]),
        }),
      }),
    } as any);
    logUsageMock.mockReset();
    logUsageMock.mockImplementation(async () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs usage for JSON responses", async () => {
    const responsePayload = {
      id: "chatcmpl-abc123",
      model: "claude-3-5-sonnet-20241022",
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 850,
        total_tokens: 2050,
      },
      choices: [],
    };

    const fetchResponse = new Response(JSON.stringify(responsePayload), {
      headers: {
        "content-type": "application/json",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(fetchResponse);
    vi.stubGlobal("fetch", fetchMock);

    const request = createRequest({
      body: { model: VALID_MODEL, messages: [] },
    });
    const response = await POST(request, { params: {} });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchArgs = fetchMock.mock.calls[0]!;
    expect((fetchArgs[0] as URL).toString()).toBe(
      "https://api.gatewayz.ai/v1/chat/completions",
    );
    const headers = fetchArgs[1]!.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-gatewayz-key");
    expect(headers.get("X-GatewayZ-User-Id")).toBe("user-123");
    expect(headers.get("X-GatewayZ-Tier")).toBe("pro");
  });

  it("authorizes requests using the Authorization header token", async () => {
    const fetchResponse = new Response(JSON.stringify({}), {
      headers: {
        "content-type": "application/json",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(fetchResponse);
    vi.stubGlobal("fetch", fetchMock);

    const request = createRequest({
      includeDefaultToken: false,
      headers: {
        Authorization: "Bearer another-daemon-token",
      },
      body: { model: VALID_MODEL, messages: [] },
    });

    await POST(request, { params: {} });

    expect(verifyApiKeyMock).toHaveBeenCalledWith({
      body: { key: "another-daemon-token" },
    });
  });

  it("rejects requests when user has free tier (no Gatewayz subscription)", async () => {
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ gwTier: "free" }]),
        }),
      }),
    } as any);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = createRequest({
      body: { model: VALID_MODEL, messages: [] },
    });
    const response = await POST(request, { params: {} });

    expect(response.status).toBe(402);
    expect(await response.text()).toContain("Gatewayz subscription required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows max tier users", async () => {
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ gwTier: "max" }]),
        }),
      }),
    } as any);

    const fetchResponse = new Response(JSON.stringify({}), {
      headers: {
        "content-type": "application/json",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(fetchResponse);
    vi.stubGlobal("fetch", fetchMock);

    const request = createRequest({
      body: { model: VALID_MODEL, messages: [] },
    });
    const response = await POST(request, { params: {} });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("logs usage for streaming responses", async () => {
    const events = [
      {
        data: {
          id: "chatcmpl-abc123",
          model: "claude-3-5-sonnet-20241022",
          choices: [{ delta: { content: "Hello" } }],
        },
      },
      {
        data: {
          id: "chatcmpl-abc123",
          model: "claude-3-5-sonnet-20241022",
          usage: {
            prompt_tokens: 1200,
            completion_tokens: 850,
            total_tokens: 2050,
          },
        },
      },
    ];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const { data } of events) {
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const fetchResponse = new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(fetchResponse);
    vi.stubGlobal("fetch", fetchMock);

    const request = createRequest({
      body: { model: VALID_MODEL, messages: [], stream: true },
    });
    const response = await POST(request, { params: {} });

    // Wait for async logging
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(response.status).toBe(200);
    expect(logUsageMock).toHaveBeenCalled();
  });

  it("supports Anthropic models via Gatewayz", async () => {
    // Create a fresh response for each call
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const models = [
      "claude-3-5-sonnet-20241022",
      "claude-opus-4",
      "claude-haiku-3",
    ];

    for (const model of models) {
      const request = createRequest({
        body: { model, messages: [] },
      });
      const response = await POST(request, { params: {} });
      expect(response.status).toBe(200);
    }
  });

  it("supports OpenAI models via Gatewayz", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const models = ["gpt-5", "gpt-5.1-codex", "gpt-4-turbo"];

    for (const model of models) {
      const request = createRequest({
        body: { model, messages: [] },
      });
      const response = await POST(request, { params: {} });
      expect(response.status).toBe(200);
    }
  });

  it("supports Gemini models via Gatewayz", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const models = ["gemini-2.5-pro", "gemini-3-pro"];

    for (const model of models) {
      const request = createRequest({
        body: { model, messages: [] },
      });
      const response = await POST(request, { params: {} });
      expect(response.status).toBe(200);
    }
  });

  it("supports Z.AI GLM models via Gatewayz", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const models = ["glm-4.7", "glm-4.7-flash", "glm-4.6"];

    for (const model of models) {
      const request = createRequest({
        body: { model, messages: [] },
      });
      const response = await POST(request, { params: {} });
      expect(response.status).toBe(200);
    }
  });

  it("rejects unsupported models", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = createRequest({
      body: { model: "unsupported-model-xyz", messages: [] },
    });
    const response = await POST(request, { params: {} });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("not supported via Gatewayz");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects requests missing the model field", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = createRequest({ body: { messages: [] } });
    const response = await POST(request, { params: {} });

    expect(response.status).toBe(400);
    expect(await response.text()).toBe(
      "Model must be specified in request body",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 for requests without daemon token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = createRequest({
      includeDefaultToken: false,
      body: { model: VALID_MODEL, messages: [] },
    });
    const response = await POST(request, { params: {} });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid daemon token", async () => {
    verifyApiKeyMock.mockResolvedValueOnce({
      valid: false,
      error: { message: "Invalid key", code: "INVALID_KEY" },
      key: null,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = createRequest({
      body: { model: VALID_MODEL, messages: [] },
    });
    const response = await POST(request, { params: {} });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
