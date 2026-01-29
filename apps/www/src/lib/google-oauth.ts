import {
  OAuth2Client,
  generateState,
  generateCodeVerifier,
  CodeChallengeMethod,
} from "arctic";
import { env } from "@terragon/env/apps-www";

export type GeminiAuthType = "subscription" | "api-key";

// Google OAuth2 endpoints
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT =
  "https://www.googleapis.com/oauth2/v2/userinfo";

// Redirect URI for Gemini OAuth flow
const getRedirectUri = () =>
  `${env.BETTER_AUTH_URL}/auth/google-gemini-redirect`;

// Scopes for Gemini API access via Google OAuth
// - generative-language scope is needed for Gemini API access
// - email and profile for user identification
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/generative-language.retriever",
  "https://www.googleapis.com/auth/cloud-platform",
];

export interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

// Create a Google OAuth2 client
function createGoogleOAuthClient() {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth credentials not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
    );
  }

  return new OAuth2Client(clientId, clientSecret, getRedirectUri());
}

// Generate authorization URL with PKCE for enhanced security
export async function createGoogleAuthorizationURL(): Promise<{
  url: URL;
  codeVerifier: string;
  state: string;
}> {
  const client = createGoogleOAuthClient();
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = client.createAuthorizationURLWithPKCE(
    GOOGLE_AUTH_ENDPOINT,
    state,
    CodeChallengeMethod.S256,
    codeVerifier,
    SCOPES,
  );

  // Add access_type=offline to get refresh token
  url.searchParams.set("access_type", "offline");
  // Prompt for consent to ensure we get refresh token
  url.searchParams.set("prompt", "consent");

  return { url, codeVerifier, state };
}

// Exchange authorization code for tokens
export async function exchangeGoogleAuthorizationCode({
  code,
  codeVerifier,
}: {
  code: string;
  codeVerifier: string;
}): Promise<GoogleTokenResponse> {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token exchange failed: ${error}`);
  }

  return response.json();
}

// Refresh an access token using a refresh token
export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token refresh failed: ${error}`);
  }

  return response.json();
}

// Get user info from Google using the access token
export async function getGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Google user info: ${error}`);
  }

  return response.json();
}

// Check if the user has Gemini API access (subscription)
// This can be determined by checking if the token works with Gemini API
export async function checkGeminiAccess(accessToken: string): Promise<{
  hasAccess: boolean;
  subscriptionType: "pro" | "ultra" | "free" | null;
}> {
  try {
    // Try to list models to verify API access
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      // Check for access to advanced models to determine subscription type
      const models = data.models || [];
      const modelNames = models.map((m: { name: string }) => m.name);

      // Check for Ultra access (highest tier)
      const hasUltra = modelNames.some((name: string) =>
        name.toLowerCase().includes("ultra"),
      );
      if (hasUltra) {
        return { hasAccess: true, subscriptionType: "ultra" };
      }

      // Check for Pro access
      const hasPro = modelNames.some(
        (name: string) =>
          name.toLowerCase().includes("pro") ||
          name.toLowerCase().includes("flash"),
      );
      if (hasPro) {
        return { hasAccess: true, subscriptionType: "pro" };
      }

      // Basic access
      return { hasAccess: true, subscriptionType: "free" };
    }

    return { hasAccess: false, subscriptionType: null };
  } catch (error) {
    console.error("Failed to check Gemini access:", error);
    return { hasAccess: false, subscriptionType: null };
  }
}
