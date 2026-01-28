import { createAuthClient } from "better-auth/react";
import { publicAppUrl } from "@terragon/env/next-public";
import {
  apiKeyClient,
  magicLinkClient,
  adminClient,
} from "better-auth/client/plugins";
import { stripeClient } from "@better-auth/stripe/client";

/**
 * Get the session token from sessionStorage if available.
 * This is used in embed mode (iframe) where third-party cookies are blocked.
 */
function getSessionTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem("terragon_session_token");
  } catch {
    return null;
  }
}

/**
 * Check if we're in embed mode (running in an iframe from GatewayZ).
 */
function isEmbedMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem("gw_embed_mode") === "true";
  } catch {
    return false;
  }
}

export const authClient = createAuthClient({
  baseURL: publicAppUrl(),
  plugins: [
    apiKeyClient(),
    magicLinkClient(),
    adminClient(),
    stripeClient({
      subscription: true, //if you want to enable subscription management
    }),
  ],
  // In embed mode, include the session token as a Bearer token
  // since third-party cookies are blocked
  fetchOptions: {
    onRequest: (ctx) => {
      if (isEmbedMode()) {
        const token = getSessionTokenFromStorage();
        if (token) {
          ctx.headers.set("Authorization", `Bearer ${token}`);
        }
      }
      return ctx;
    },
  },
});
