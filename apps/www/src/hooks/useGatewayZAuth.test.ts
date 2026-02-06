/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGatewayZAuth } from "./useGatewayZAuth";

describe("useGatewayZAuth", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location
    const mockLocation = {
      ...originalLocation,
      href: "https://inbox.gatewayz.ai",
      origin: "https://inbox.gatewayz.ai",
    };
    Object.defineProperty(window, "location", {
      value: mockLocation,
      writable: true,
      configurable: true,
    });

    // Mock parent to be different from window (simulate iframe)
    Object.defineProperty(window, "parent", {
      value: {
        postMessage: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it("should listen for GATEWAYZ_AUTH messages", () => {
    const onAuthReceived = vi.fn();
    renderHook(() => useGatewayZAuth({ enabled: true, onAuthReceived }));

    // Simulate receiving auth message from allowed origin
    const messageEvent = new MessageEvent("message", {
      origin: "https://beta.gatewayz.ai",
      data: {
        type: "GATEWAYZ_AUTH",
        token: "test-token-123",
      },
    });

    act(() => {
      window.dispatchEvent(messageEvent);
    });

    expect(onAuthReceived).toHaveBeenCalled();
    expect(window.location.href).toContain("/api/auth/gatewayz/callback");
    expect(window.location.href).toContain("gwauth=test-token-123");
    expect(window.location.href).toContain("embed=true");
  });

  it("should ignore messages from non-allowed origins", () => {
    const onAuthReceived = vi.fn();
    renderHook(() => useGatewayZAuth({ enabled: true, onAuthReceived }));

    // Simulate receiving auth message from disallowed origin
    const messageEvent = new MessageEvent("message", {
      origin: "https://malicious-site.com",
      data: {
        type: "GATEWAYZ_AUTH",
        token: "malicious-token",
      },
    });

    act(() => {
      window.dispatchEvent(messageEvent);
    });

    expect(onAuthReceived).not.toHaveBeenCalled();
  });

  it("should ignore messages without token", () => {
    const onAuthReceived = vi.fn();
    renderHook(() => useGatewayZAuth({ enabled: true, onAuthReceived }));

    const messageEvent = new MessageEvent("message", {
      origin: "https://beta.gatewayz.ai",
      data: {
        type: "GATEWAYZ_AUTH",
        // No token
      },
    });

    act(() => {
      window.dispatchEvent(messageEvent);
    });

    expect(onAuthReceived).not.toHaveBeenCalled();
  });

  it("should ignore non-GATEWAYZ_AUTH messages", () => {
    const onAuthReceived = vi.fn();
    renderHook(() => useGatewayZAuth({ enabled: true, onAuthReceived }));

    const messageEvent = new MessageEvent("message", {
      origin: "https://beta.gatewayz.ai",
      data: {
        type: "OTHER_MESSAGE_TYPE",
        token: "test-token",
      },
    });

    act(() => {
      window.dispatchEvent(messageEvent);
    });

    expect(onAuthReceived).not.toHaveBeenCalled();
  });

  it("should not listen when disabled", () => {
    const onAuthReceived = vi.fn();
    renderHook(() => useGatewayZAuth({ enabled: false, onAuthReceived }));

    const messageEvent = new MessageEvent("message", {
      origin: "https://beta.gatewayz.ai",
      data: {
        type: "GATEWAYZ_AUTH",
        token: "test-token-123",
      },
    });

    act(() => {
      window.dispatchEvent(messageEvent);
    });

    expect(onAuthReceived).not.toHaveBeenCalled();
  });

  it("should send auth request to parent window", async () => {
    vi.useFakeTimers();
    const mockPostMessage = vi.fn();
    Object.defineProperty(window, "parent", {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true,
    });

    renderHook(() => useGatewayZAuth({ enabled: true }));

    // Advance timers to trigger the request
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Should have sent auth request to allowed origins
    expect(mockPostMessage).toHaveBeenCalledWith(
      { type: "GATEWAYZ_AUTH_REQUEST" },
      expect.any(String),
    );

    vi.useRealTimers();
  });

  it("should only process auth once (prevent duplicates)", () => {
    const onAuthReceived = vi.fn();
    renderHook(() => useGatewayZAuth({ enabled: true, onAuthReceived }));

    const messageEvent = new MessageEvent("message", {
      origin: "https://beta.gatewayz.ai",
      data: {
        type: "GATEWAYZ_AUTH",
        token: "test-token-123",
      },
    });

    // Send the same message twice
    act(() => {
      window.dispatchEvent(messageEvent);
      window.dispatchEvent(messageEvent);
    });

    // Should only be called once
    expect(onAuthReceived).toHaveBeenCalledTimes(1);
  });

  it("should accept messages from all allowed origins", () => {
    const allowedOrigins = [
      "https://gatewayz.ai",
      "https://www.gatewayz.ai",
      "https://beta.gatewayz.ai",
      "https://inbox.gatewayz.ai",
    ];

    allowedOrigins.forEach((origin, index) => {
      // Reset for each test
      const onAuthReceived = vi.fn();
      const mockLocation = {
        ...originalLocation,
        href: "https://inbox.gatewayz.ai",
        origin: "https://inbox.gatewayz.ai",
      };
      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
        configurable: true,
      });

      const { unmount } = renderHook(() =>
        useGatewayZAuth({ enabled: true, onAuthReceived }),
      );

      const messageEvent = new MessageEvent("message", {
        origin,
        data: {
          type: "GATEWAYZ_AUTH",
          token: `test-token-${index}`,
        },
      });

      act(() => {
        window.dispatchEvent(messageEvent);
      });

      expect(onAuthReceived).toHaveBeenCalled();
      unmount();
    });
  });
});
