"use server";

import {
  AuthType,
  createAnthropicAPIKey,
  createAuthorizationURL,
  exchangeAuthorizationCode,
  refreshAccessToken,
} from "@/lib/claude-oauth";
import { saveClaudeTokens } from "@/agent/msg/claudeCredentials";
import { userOnlyAction } from "@/lib/auth-server";
import { getPostHogServer } from "@/lib/posthog-server";
import { UserFacingError } from "@/lib/server-actions";

export const getAuthorizationURL = userOnlyAction(
  async function getAuthorizationURL(
    userId: string,
    { type }: { type: AuthType },
  ) {
    return await createAuthorizationURL({ type });
  },
  { defaultErrorMessage: "Failed to get authorization URL" },
);

export const exchangeCode = userOnlyAction(
  async function exchangeCode(
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
      authType: AuthType;
    },
  ) {
    // Exchange the code for tokens
    const tokenResponse = await exchangeAuthorizationCode({
      code,
      codeVerifier,
      state,
    });
    await saveClaudeTokens({
      userId,
      tokenData: {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        // If auth type is api-key, create an Anthropic API key
        anthropicApiKey:
          authType === "api-key"
            ? await createAnthropicAPIKey(tokenResponse.access_token)
            : undefined,
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
      event: "claude_oauth_token_saved",
      properties: {
        authType,
      },
    });
  },
  { defaultErrorMessage: "Token exchange failed" },
);

export const saveClaudeCredentialsJson = userOnlyAction(
  async function saveClaudeCredentialsJson(
    userId: string,
    { credentialsJson }: { credentialsJson: string },
  ) {
    const parsed = JSON.parse(credentialsJson || "{}");

    // Check for claudeAiOauth object
    const claudeAiOauth = parsed.claudeAiOauth;
    if (!claudeAiOauth || typeof claudeAiOauth !== "object") {
      throw new UserFacingError(
        "Invalid credentials format. Expected claudeAiOauth object.",
      );
    }

    const accessToken: string | undefined = claudeAiOauth.accessToken;
    const refreshToken: string | undefined = claudeAiOauth.refreshToken;
    const expiresAt: number | undefined = claudeAiOauth.expiresAt;
    const scopes: string[] | undefined = claudeAiOauth.scopes;

    if (!accessToken) {
      throw new UserFacingError(
        "Invalid credentials. Missing accessToken in claudeAiOauth.",
      );
    }

    // Validate scopes is an array if provided
    if (scopes !== undefined && !Array.isArray(scopes)) {
      throw new UserFacingError(
        "Invalid credentials format. scopes must be an array of strings.",
      );
    }

    // Try to refresh the token to verify it's valid
    let finalAccessToken = accessToken;
    let finalRefreshToken = refreshToken;
    // expiresAt from credentials.json is in milliseconds (timestamp)
    let finalExpiresAt = expiresAt
      ? new Date(expiresAt)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    if (refreshToken) {
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        finalAccessToken = refreshed.access_token;
        finalRefreshToken = refreshed.refresh_token ?? refreshToken;
        finalExpiresAt = refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000)
          : finalExpiresAt;
      } catch (err) {
        console.warn("Claude token refresh failed, using provided tokens", err);
        throw new UserFacingError(
          "Invalid Claude credentials. Please ensure your credentials are current and try again.",
        );
      }
    }

    await saveClaudeTokens({
      userId,
      tokenData: {
        accessToken: finalAccessToken,
        refreshToken: finalRefreshToken,
        isSubscription: true,
        expiresAt: finalExpiresAt,
        scope: Array.isArray(scopes) ? scopes.join(" ") : undefined,
        tokenType: "Bearer",
      },
    });

    getPostHogServer().capture({
      distinctId: userId,
      event: "claude_credentials_json_saved",
      properties: {},
    });
  },
  { defaultErrorMessage: "Failed to save Claude credentials" },
);
