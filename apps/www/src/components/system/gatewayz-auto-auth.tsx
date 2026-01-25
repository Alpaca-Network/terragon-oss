"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Allowed origins for postMessage authentication.
 * Only messages from these origins will be processed.
 */
const ALLOWED_ORIGINS = [
  "https://beta.gatewayz.ai",
  "https://gatewayz.ai",
  "https://www.gatewayz.ai",
  // Allow localhost for development
  ...(process.env.NODE_ENV === "development"
    ? [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
      ]
    : []),
];

/**
 * Check if an origin is allowed to send auth messages.
 *
 * @param origin - The origin to validate
 * @returns True if the origin is in the allowed list
 */
function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * GatewayZ Auto-Auth Component
 *
 * This component enables seamless SSO from GatewayZ to Terragon.
 * When embedded in an iframe with `awaitAuth=true`, it:
 * 1. Sends a GATEWAYZ_AUTH_REQUEST message to the parent window
 * 2. Listens for GATEWAYZ_AUTH message with the auth token
 * 3. Redirects to the callback API to create a session
 *
 * Security: Only processes messages from allowed GatewayZ origins.
 *
 * This allows users who are already logged into GatewayZ to automatically
 * be authenticated in Terragon without clicking any login buttons.
 */
export function GatewayZAutoAuth() {
  const searchParams = useSearchParams();
  const authProcessedRef = useRef(false);
  const requestSentRef = useRef(false);

  // Check if we should await auth from parent
  const awaitAuth = searchParams.get("awaitAuth") === "true";
  const isEmbed = searchParams.get("embed") === "true";

  /**
   * Handle incoming auth token by redirecting to the callback API.
   *
   * @param token - The encrypted GatewayZ auth token
   */
  const handleAuthToken = useCallback(
    (token: string) => {
      if (authProcessedRef.current) return;
      authProcessedRef.current = true;

      // Redirect to the callback API to create a session
      // The callback will verify the token, create/link the user, and redirect to dashboard
      const callbackUrl = new URL(
        "/api/auth/gatewayz/callback",
        window.location.origin,
      );
      callbackUrl.searchParams.set("gwauth", token);
      callbackUrl.searchParams.set("returnUrl", "/dashboard");
      if (isEmbed) {
        callbackUrl.searchParams.set("embed", "true");
      }

      window.location.href = callbackUrl.toString();
    },
    [isEmbed],
  );

  /**
   * Request authentication token from parent window via postMessage.
   * Uses "*" as target origin since we don't know the parent's origin,
   * but the parent will validate the request origin before responding.
   */
  const requestAuthFromParent = useCallback(() => {
    if (requestSentRef.current || !window.parent || window.parent === window) {
      return;
    }

    requestSentRef.current = true;

    // Send request to parent - use "*" since we don't know the parent origin
    // The parent will validate the request origin before responding
    window.parent.postMessage({ type: "GATEWAYZ_AUTH_REQUEST" }, "*");
  }, []);

  useEffect(() => {
    // Only activate if we're in embed mode and awaiting auth
    if (!awaitAuth || !isEmbed) {
      return;
    }

    /**
     * Handle incoming postMessage events.
     * Only processes GATEWAYZ_AUTH messages from allowed origins.
     */
    const handleMessage = (event: MessageEvent) => {
      // Security: Validate origin before processing
      if (!isAllowedOrigin(event.origin)) {
        return;
      }

      // Validate message structure
      if (!event.data || typeof event.data !== "object") {
        return;
      }

      if (event.data.type === "GATEWAYZ_AUTH" && event.data.token) {
        handleAuthToken(event.data.token);
      }
    };

    window.addEventListener("message", handleMessage);

    // Request auth from parent after a short delay to ensure parent is ready
    const timeoutId = setTimeout(requestAuthFromParent, 100);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timeoutId);
    };
  }, [awaitAuth, isEmbed, handleAuthToken, requestAuthFromParent]);

  // This component doesn't render anything visible
  return null;
}
