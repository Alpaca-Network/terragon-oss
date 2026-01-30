import { db } from "@/lib/db";
import { retryAsync } from "@terragon/utils/retry";
import {
  refreshGoogleAccessToken,
  checkGeminiAccess,
} from "@/lib/google-oauth";
import { env } from "@terragon/env/apps-www";
import { GeminiAgentProviderMetadata } from "@terragon/shared";
import {
  getValidAccessTokenForCredential,
  insertAgentProviderCredentials,
  getAgentProviderCredentialsDecrypted,
  getAgentProviderCredentialsDecryptedById,
} from "@terragon/shared/model/agent-provider-credentials";

type AccountInfo = Pick<
  GeminiAgentProviderMetadata,
  "accountId" | "accountEmail" | "isSubscription" | "subscriptionType" | "scope"
>;

/**
 * Check Gemini subscription status and return account info
 */
async function getAccountInfoFromToken({
  accessToken,
}: {
  accessToken?: string;
}): Promise<AccountInfo | null> {
  if (!accessToken) {
    return null;
  }
  try {
    const geminiAccess = await checkGeminiAccess(accessToken);
    if (geminiAccess.hasAccess) {
      return {
        isSubscription: true,
        subscriptionType: geminiAccess.subscriptionType ?? "free",
      };
    }
    return null;
  } catch (error) {
    console.error(
      "[getAccountInfoFromToken] Failed to get Gemini account info:",
      error,
    );
    return null;
  }
}

type TokenData = {
  accessToken?: string;
  refreshToken?: string;
  isSubscription: boolean;
  expiresAt: Date | null;
  scope?: string;
  tokenType?: string;
};

/**
 * Store Gemini OAuth tokens for a user
 */
export async function saveGeminiTokens({
  userId,
  tokenData,
}: {
  userId: string;
  tokenData: TokenData;
}): Promise<void> {
  const accountInfo = await getAccountInfoFromToken({
    accessToken: tokenData.accessToken,
  });
  await insertAgentProviderCredentials({
    db,
    userId,
    credentialData: {
      type: "oauth",
      agent: "gemini",
      isActive: true,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt: tokenData.expiresAt,
      lastRefreshedAt: new Date(),
      metadata: {
        type: "gemini",
        scope: tokenData.scope ?? undefined,
        accountEmail: accountInfo?.accountEmail,
        accountId: accountInfo?.accountId,
        isSubscription: tokenData.isSubscription,
        subscriptionType: accountInfo?.subscriptionType ?? "free",
      },
    },
    encryptionKey: env.ENCRYPTION_MASTER_KEY,
  });
}

/**
 * Get a valid Gemini access token, refreshing if necessary
 */
async function getValidAccessTokenInternal({
  userId,
  credentialId,
  forceRefresh = false,
}: {
  userId: string;
  credentialId: string;
  forceRefresh?: boolean;
}): Promise<string | null> {
  return await getValidAccessTokenForCredential({
    db,
    userId,
    credentialId,
    encryptionKey: env.ENCRYPTION_MASTER_KEY,
    forceRefresh,
    refreshTokenCallback: async ({ refreshToken }) => {
      const response = await refreshGoogleAccessToken(refreshToken);
      const accountInfo = await getAccountInfoFromToken({
        accessToken: response.access_token,
      });
      return {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresAt: response.expires_in
          ? new Date(Date.now() + response.expires_in * 1000)
          : null,
        metadata: {
          type: "gemini",
          scope: response.scope,
          accountEmail: accountInfo?.accountEmail,
          accountId: accountInfo?.accountId,
          isSubscription: true,
          subscriptionType: accountInfo?.subscriptionType ?? "free",
        },
      };
    },
  });
}

/**
 * Wraps getValidAccessTokenInternal with retry to handle the case where
 * multiple processes refresh the token at the same time.
 */
async function getValidAccessToken({
  userId,
  credentialId,
  forceRefresh = false,
}: {
  userId: string;
  credentialId: string;
  forceRefresh?: boolean;
}): Promise<string | null> {
  return retryAsync(
    () => {
      return getValidAccessTokenInternal({
        userId,
        credentialId,
        forceRefresh,
      });
    },
    { label: "getValidAccessToken (gemini)" },
  );
}

/**
 * Force refresh of Gemini credentials (for admin use)
 */
export async function forceRefreshGeminiCredentials({
  userId,
  credentialId,
}: {
  userId: string;
  credentialId: string;
}): Promise<string | null> {
  return getValidAccessToken({ userId, credentialId, forceRefresh: true });
}

/**
 * Get Gemini credentials for daemon use.
 * For OAuth subscriptions, returns the access token.
 * For API keys, returns the API key.
 */
export async function getGeminiCredentialsOrNull({
  userId,
}: {
  userId: string;
}): Promise<{
  token: string | null;
  isSubscription: boolean;
  subscriptionType: "pro" | "ultra" | "free" | null;
  error: string | null;
}> {
  try {
    // Get the stored credentials
    const credentials = await getAgentProviderCredentialsDecrypted({
      db,
      userId,
      agent: "gemini",
      encryptionKey: env.ENCRYPTION_MASTER_KEY,
    });
    if (!credentials) {
      return {
        token: null,
        isSubscription: false,
        subscriptionType: null,
        error: null,
      };
    }
    // For API keys, just return the API key
    if (credentials.apiKey) {
      return {
        token: credentials.apiKey,
        isSubscription: false,
        subscriptionType: null,
        error: null,
      };
    }
    if (!credentials.accessToken) {
      return {
        token: null,
        isSubscription: false,
        subscriptionType: null,
        error: null,
      };
    }
    // Try to refresh the token if needed
    const validAccessToken = await getValidAccessToken({
      userId,
      credentialId: credentials.id,
    });

    let finalCredentials = credentials;
    if (validAccessToken && validAccessToken !== credentials.accessToken) {
      const reloaded = await getAgentProviderCredentialsDecryptedById({
        db,
        userId,
        credentialId: credentials.id,
        encryptionKey: env.ENCRYPTION_MASTER_KEY,
      });
      if (reloaded) {
        finalCredentials = reloaded;
      }
    }
    if (!finalCredentials.accessToken) {
      return {
        token: null,
        isSubscription: false,
        subscriptionType: null,
        error: null,
      };
    }

    let subscriptionType: "pro" | "ultra" | "free" | null = null;
    if (finalCredentials.metadata?.type === "gemini") {
      subscriptionType = finalCredentials.metadata.subscriptionType ?? null;
    }

    return {
      token: finalCredentials.accessToken,
      isSubscription: true,
      subscriptionType,
      error: null,
    };
  } catch (error) {
    console.error(
      "[getGeminiCredentialsOrNull] Failed to get credentials:",
      error,
    );
    return {
      token: null,
      isSubscription: false,
      subscriptionType: null,
      error: "Failed to get Gemini credentials",
    };
  }
}
