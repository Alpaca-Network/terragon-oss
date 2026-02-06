"use client";

import { useEffect, useCallback, useRef } from "react";

/**
 * Default allowed origins for receiving postMessage auth from GatewayZ.
 * These are the trusted GatewayZ domains that can send auth tokens.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://gatewayz.ai",
  "https://www.gatewayz.ai",
  "https://beta.gatewayz.ai",
  "https://inbox.gatewayz.ai",
];

/**
 * Get allowed origins from environment or use defaults.
 */
function getAllowedOrigins(): string[] {
  if (typeof window === "undefined") return DEFAULT_ALLOWED_ORIGINS;

  const envOrigins = process.env.NEXT_PUBLIC_GATEWAYZ_ALLOWED_ORIGINS;
  if (envOrigins) {
    const origins = envOrigins
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
  }
  return DEFAULT_ALLOWED_ORIGINS;
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

    try {
      if (window.parent && window.parent !== window) {
        const allowedOrigins = getAllowedOrigins();
        allowedOrigins.forEach((origin) => {
          try {
            window.parent.postMessage(
              { type: "GATEWAYZ_AUTH_REQUEST" },
              origin,
            );
          } catch {
            // Ignore errors for origins that don't match actual parent
          }
        });
        requestSentRef.current = true;
      }
    } catch {
      // Ignore errors (e.g., cross-origin restrictions)
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      // Prevent duplicate processing
      if (authReceivedRef.current) return;

      // Validate origin
      const allowedOrigins = getAllowedOrigins();
      if (!allowedOrigins.includes(event.origin)) {
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
