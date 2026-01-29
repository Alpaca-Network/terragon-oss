"use server";

import {
  createGoogleAuthorizationURL,
  exchangeGoogleAuthorizationCode,
  GeminiAuthType,
} from "@/lib/google-oauth";
import { saveGeminiTokens } from "@/agent/msg/geminiCredentials";
import { userOnlyAction } from "@/lib/auth-server";
import { getPostHogServer } from "@/lib/posthog-server";

export const getGoogleAuthorizationURL = userOnlyAction(
  async function getGoogleAuthorizationURL(
    userId: string,
    { type }: { type: GeminiAuthType },
  ) {
    return await createGoogleAuthorizationURL();
  },
  { defaultErrorMessage: "Failed to get Google authorization URL" },
);

export const exchangeGoogleCode = userOnlyAction(
  async function exchangeGoogleCode(
    userId: string,
    {
      code,
      codeVerifier,
      state,
      authType,
    }: {
      code: string;
      codeVerifier: string;
      state: string;
      authType: GeminiAuthType;
    },
  ) {
    // Exchange the code for tokens
    const tokenResponse = await exchangeGoogleAuthorizationCode({
      code,
      codeVerifier,
    });
    await saveGeminiTokens({
      userId,
      tokenData: {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        isSubscription: authType === "subscription",
        tokenType: tokenResponse.token_type,
        expiresAt: tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : null,
        scope: tokenResponse.scope,
      },
    });
    getPostHogServer().capture({
      distinctId: userId,
      event: "google_oauth_token_saved",
      properties: {
        authType,
      },
    });
  },
  { defaultErrorMessage: "Google OAuth token exchange failed" },
);
