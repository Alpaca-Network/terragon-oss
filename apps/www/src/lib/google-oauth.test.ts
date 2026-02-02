import { describe, it, expect, vi, beforeEach } from "vitest";

const envMock = vi.hoisted(() => ({
  GOOGLE_OAUTH_CLIENT_ID: "test-client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-client-secret",
  BETTER_AUTH_URL: "https://test.example.com",
}));

vi.mock("@terragon/env/apps-www", () => ({
  env: envMock,
}));

describe("Google OAuth", () => {
  let googleOauth: typeof import("./google-oauth");

  beforeEach(async () => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.resetModules();
    googleOauth = await import("./google-oauth");
  });

  describe("createGoogleAuthorizationURL", () => {
    it("should generate authorization URL with PKCE", async () => {
      const result = await googleOauth.createGoogleAuthorizationURL();

      expect(result.url).toBeInstanceOf(URL);
      expect(result.codeVerifier).toBeTruthy();
      expect(result.state).toBeTruthy();

      // Check URL contains required parameters
      const url = result.url;
      expect(url.origin).toBe("https://accounts.google.com");
      expect(url.pathname).toBe("/o/oauth2/v2/auth");
      expect(url.searchParams.get("client_id")).toBe("test-client-id");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "https://test.example.com/auth/google-gemini-redirect",
      );
      expect(url.searchParams.get("access_type")).toBe("offline");
      expect(url.searchParams.get("prompt")).toBe("consent");
    });
  });

  describe("exchangeGoogleAuthorizationCode", () => {
    it("should exchange code for tokens", async () => {
      const mockResponse = {
        access_token: "test-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "test-refresh-token",
        scope: "openid email profile",
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await googleOauth.exchangeGoogleAuthorizationCode({
        code: "test-code",
        codeVerifier: "test-verifier",
      });

      expect(result.access_token).toBe("test-access-token");
      expect(result.refresh_token).toBe("test-refresh-token");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }),
      );
    });

    it("should throw error on failed exchange", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Invalid code"),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        googleOauth.exchangeGoogleAuthorizationCode({
          code: "invalid-code",
          codeVerifier: "test-verifier",
        }),
      ).rejects.toThrow("Google token exchange failed");
    });
  });

  describe("refreshGoogleAccessToken", () => {
    it("should refresh access token", async () => {
      const mockResponse = {
        access_token: "new-access-token",
        token_type: "Bearer",
        expires_in: 3600,
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result =
        await googleOauth.refreshGoogleAccessToken("test-refresh-token");

      expect(result.access_token).toBe("new-access-token");
      expect(fetchMock).toHaveBeenCalled();
    });

    it("should throw error on failed refresh", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Invalid refresh token"),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        googleOauth.refreshGoogleAccessToken("invalid-refresh-token"),
      ).rejects.toThrow("Google token refresh failed");
    });
  });

  describe("getGoogleUserInfo", () => {
    it("should get user info from access token", async () => {
      const mockUserInfo = {
        id: "user-123",
        email: "test@example.com",
        verified_email: true,
        name: "Test User",
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUserInfo),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await googleOauth.getGoogleUserInfo("test-access-token");

      expect(result.email).toBe("test@example.com");
      expect(result.name).toBe("Test User");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: "Bearer test-access-token",
          },
        },
      );
    });
  });

  describe("checkGeminiAccess", () => {
    it("should return pro subscription for pro models", async () => {
      const mockModels = {
        models: [
          { name: "models/gemini-pro" },
          { name: "models/gemini-pro-vision" },
        ],
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockModels),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await googleOauth.checkGeminiAccess("test-access-token");

      expect(result.hasAccess).toBe(true);
      expect(result.subscriptionType).toBe("pro");
    });

    it("should return ultra subscription for ultra models", async () => {
      const mockModels = {
        models: [
          { name: "models/gemini-ultra" },
          { name: "models/gemini-pro" },
        ],
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockModels),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await googleOauth.checkGeminiAccess("test-access-token");

      expect(result.hasAccess).toBe(true);
      expect(result.subscriptionType).toBe("ultra");
    });

    it("should return no access on API error", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await googleOauth.checkGeminiAccess("invalid-token");

      expect(result.hasAccess).toBe(false);
      expect(result.subscriptionType).toBe(null);
    });
  });
});
