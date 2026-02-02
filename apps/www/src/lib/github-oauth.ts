import { DB } from "@terragon/shared/db";
import * as schema from "@terragon/shared/db/schema";
import { eq, and } from "drizzle-orm";
import {
  decryptTokenWithBackwardsCompatibility,
  encryptToken,
} from "@terragon/utils/encryption";

// GitHub user access tokens expire after 8 hours
// We use a 1-hour buffer to ensure we refresh before expiration
const TOKEN_EXPIRY_BUFFER_MS = 60 * 60 * 1000; // 1 hour

// Maximum number of retries for optimistic locking conflicts
const MAX_REFRESH_RETRIES = 3;

interface GitHubTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  token_type: string;
  scope: string;
}

interface GitHubTokenErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * Refreshes a GitHub OAuth token using the refresh_token grant.
 * Returns the new access token, refresh token, and their expiration times.
 */
export async function refreshGitHubToken({
  refreshToken,
  clientId,
  clientSecret,
}: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<GitHubTokenResponse> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as
    | GitHubTokenResponse
    | GitHubTokenErrorResponse;

  if ("error" in data) {
    throw new Error(
      `GitHub token refresh error: ${data.error}${data.error_description ? ` - ${data.error_description}` : ""}`,
    );
  }

  return data;
}

/**
 * Checks if a GitHub access token is expired or about to expire.
 * Uses a buffer time to refresh tokens before they actually expire.
 */
export function isTokenExpiredOrExpiringSoon(
  expiresAt: Date | null,
  bufferMs: number = TOKEN_EXPIRY_BUFFER_MS,
): boolean {
  if (!expiresAt) {
    // If no expiration is set, treat as non-expiring (classic OAuth app tokens)
    return false;
  }
  return expiresAt.getTime() - bufferMs < Date.now();
}

/**
 * Gets a valid GitHub access token for a user, refreshing if necessary.
 * This function handles the full lifecycle of token management:
 * 1. Retrieves the current token from the database
 * 2. Checks if it's expired or expiring soon
 * 3. If expired and refresh token exists, refreshes the token
 * 4. Updates the database with new tokens using optimistic locking
 * 5. Returns the valid access token
 *
 * Uses optimistic locking with the updatedAt field to handle concurrent
 * refresh attempts across serverless instances. If another instance refreshed
 * the token first, we re-read and use the newly refreshed token.
 */
export async function getGitHubUserAccessTokenWithRefresh({
  db,
  userId,
  encryptionKey,
  githubClientId,
  githubClientSecret,
}: {
  db: DB;
  userId: string;
  encryptionKey: string;
  githubClientId: string;
  githubClientSecret: string;
}): Promise<string> {
  for (let attempt = 0; attempt < MAX_REFRESH_RETRIES; attempt++) {
    const githubAccounts = await db
      .select()
      .from(schema.account)
      .where(
        and(
          eq(schema.account.userId, userId),
          eq(schema.account.providerId, "github"),
        ),
      )
      .execute();

    if (githubAccounts.length === 0) {
      throw new Error("No GitHub account found");
    }

    const githubAccount = githubAccounts[0]!;

    if (!githubAccount.accessToken) {
      throw new Error("No GitHub access token found");
    }

    // Decrypt tokens
    const accessToken = decryptTokenWithBackwardsCompatibility(
      githubAccount.accessToken,
      encryptionKey,
    );

    // Check if token is expired or expiring soon
    const isExpired = isTokenExpiredOrExpiringSoon(
      githubAccount.accessTokenExpiresAt,
    );

    if (!isExpired) {
      // Token is still valid, return it
      return accessToken;
    }

    // Token is expired or expiring soon, try to refresh
    if (!githubAccount.refreshToken) {
      // No refresh token available - this could be a classic OAuth app token
      // or the token was created before refresh tokens were enabled.
      // Return the existing token and hope it's still valid.
      console.warn(
        "GitHub access token is expired but no refresh token available",
      );
      return accessToken;
    }

    // Attempt to refresh with optimistic locking
    const result = await performTokenRefresh({
      db,
      userId,
      githubAccount,
      encryptionKey,
      githubClientId,
      githubClientSecret,
      accessToken,
    });

    if (result.success) {
      return result.token;
    }

    if (result.reason === "error") {
      // Refresh API call failed - return existing token and hope it's still valid
      return accessToken;
    }

    // Optimistic lock conflict - another instance refreshed first
    // Loop will re-read and get the new token
    console.log(
      `Token refresh conflict for user ${userId}, attempt ${attempt + 1}/${MAX_REFRESH_RETRIES}`,
    );
  }

  // After max retries, re-read once more to get whatever token is there
  const finalAccounts = await db
    .select()
    .from(schema.account)
    .where(
      and(
        eq(schema.account.userId, userId),
        eq(schema.account.providerId, "github"),
      ),
    )
    .execute();

  if (finalAccounts.length === 0 || !finalAccounts[0]!.accessToken) {
    throw new Error("No GitHub access token found after refresh attempts");
  }

  return decryptTokenWithBackwardsCompatibility(
    finalAccounts[0]!.accessToken,
    encryptionKey,
  );
}

type TokenRefreshResult =
  | { success: true; token: string }
  | { success: false; reason: "conflict" | "error" };

/**
 * Internal function that performs the actual token refresh.
 * Uses optimistic locking with updatedAt to prevent race conditions
 * in serverless environments where multiple instances may try to
 * refresh the same token simultaneously.
 */
async function performTokenRefresh({
  db,
  userId,
  githubAccount,
  encryptionKey,
  githubClientId,
  githubClientSecret,
  accessToken,
}: {
  db: DB;
  userId: string;
  githubAccount: {
    id: string;
    refreshToken: string | null;
    updatedAt: Date;
  };
  encryptionKey: string;
  githubClientId: string;
  githubClientSecret: string;
  accessToken: string;
}): Promise<TokenRefreshResult> {
  const refreshToken = decryptTokenWithBackwardsCompatibility(
    githubAccount.refreshToken!,
    encryptionKey,
  );

  console.log("Refreshing expired GitHub access token for user:", userId);

  try {
    // Refresh the token
    const newTokens = await refreshGitHubToken({
      refreshToken,
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    });

    // Calculate new expiration times
    const now = new Date();
    const accessTokenExpiresAt = new Date(
      now.getTime() + newTokens.expires_in * 1000,
    );
    const refreshTokenExpiresAt = new Date(
      now.getTime() + newTokens.refresh_token_expires_in * 1000,
    );

    // Encrypt new tokens
    const encryptedAccessToken = encryptToken(
      newTokens.access_token,
      encryptionKey,
    );
    const encryptedRefreshToken = encryptToken(
      newTokens.refresh_token,
      encryptionKey,
    );

    // Update the database with new tokens using optimistic locking.
    // Only update if updatedAt matches what we read, preventing concurrent updates.
    // We use .returning() to get the updated row, which reliably tells us if the update succeeded.
    const updateResult = await db
      .update(schema.account)
      .set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.account.id, githubAccount.id),
          eq(schema.account.updatedAt, githubAccount.updatedAt),
        ),
      )
      .returning({ id: schema.account.id });

    // Check if the update succeeded by checking if a row was returned
    if (updateResult.length === 0) {
      // Another instance already refreshed the token
      console.log(
        "Token refresh conflict detected - another instance refreshed first for user:",
        userId,
      );
      return { success: false, reason: "conflict" };
    }

    console.log("Successfully refreshed GitHub access token for user:", userId);

    return { success: true, token: newTokens.access_token };
  } catch (error) {
    // If refresh fails, log the error and return failure
    // The caller can decide to use the existing token
    console.error("Failed to refresh GitHub token:", error);
    return { success: false, reason: "error" };
  }
}
