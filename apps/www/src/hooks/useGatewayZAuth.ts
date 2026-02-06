"use client";

import { useEffect, useCallback, useRef } from "react";

/**
 * Allowed origins for receiving postMessage auth from GatewayZ.
 * These are the trusted GatewayZ domains that can send auth tokens.
 * Must match the allowed origins in the server callback route.
 */
const ALLOWED_ORIGINS = [
  "https://gatewayz.ai",
  "https://www.gatewayz.ai",
  "https://beta.gatewayz.ai",
  "https://inbox.gatewayz.ai",
];

/**
 * Check if currently running in an iframe context.
 */
function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.parent !== window;
  } catch {
    // Cross-origin iframe access throws, which means we're in an iframe
    return true;
  }
}

interface UseGatewayZAuthOptions {
  /**
   * Whether to enable listening for auth messages.
   * Should only be true in embed mode.
   */
  enabled?: boolean;
  /**
   * Callback when auth is received and navigation is about to happen.
   */
  onAuthReceived?: () => void;
}

/**
 * Hook to listen for GatewayZ authentication via postMessage.
 *
 * When embedded in GatewayZ's /inbox page, the parent window sends
 * auth credentials via postMessage. This hook:
 * 1. Listens for GATEWAYZ_AUTH messages from allowed origins
 * 2. Validates the message contains a token
 * 3. Redirects to the callback route to complete authentication
 *
 * Also sends GATEWAYZ_AUTH_REQUEST to parent on mount so GatewayZ
 * can resend auth if the initial message was missed.
 */
export function useGatewayZAuth(options: UseGatewayZAuthOptions = {}) {
  const { enabled = true, onAuthReceived } = options;
  const authReceivedRef = useRef(false);
  const requestSentRef = useRef(false);

  // Request auth from parent window
  const requestAuth = useCallback(() => {
    if (typeof window === "undefined" || requestSentRef.current) return;

    // Only send requests when in an iframe
    if (!isInIframe()) return;

    try {
      ALLOWED_ORIGINS.forEach((origin) => {
        try {
          window.parent.postMessage({ type: "GATEWAYZ_AUTH_REQUEST" }, origin);
        } catch {
          // Ignore errors for origins that don't match actual parent
        }
      });
      requestSentRef.current = true;
    } catch {
      // Ignore errors (e.g., cross-origin restrictions)
    }
  }, []);

  useEffect(() => {
    // Only enable when explicitly enabled AND running in an iframe
    // This prevents auth hijacking via window.open from allowed origins
    if (!enabled || typeof window === "undefined" || !isInIframe()) return;

    const handleMessage = (event: MessageEvent) => {
      // Prevent duplicate processing
      if (authReceivedRef.current) return;

      // Validate origin against allowed list
      if (!ALLOWED_ORIGINS.includes(event.origin)) {
        return;
      }

      // Check for GATEWAYZ_AUTH message with token
      if (event.data?.type === "GATEWAYZ_AUTH" && event.data?.token) {
        authReceivedRef.current = true;

        // Notify callback if provided
        onAuthReceived?.();

        // Build callback URL with the token
        const callbackUrl = new URL(
          "/api/auth/gatewayz/callback",
          window.location.origin,
        );
        callbackUrl.searchParams.set("gwauth", event.data.token);
        callbackUrl.searchParams.set("embed", "true");
        callbackUrl.searchParams.set("returnUrl", "/dashboard");

        // Navigate to callback to complete auth
        window.location.href = callbackUrl.toString();
      }
    };

    window.addEventListener("message", handleMessage);

    // Request auth from parent after a short delay
    // This handles the case where the iframe loads before GatewayZ sends auth
    const requestTimeout = setTimeout(() => {
      requestAuth();
    }, 100);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(requestTimeout);
    };
  }, [enabled, onAuthReceived, requestAuth]);

  return {
    requestAuth,
  };
}
