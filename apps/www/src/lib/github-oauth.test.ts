import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  refreshGitHubToken,
  isTokenExpiredOrExpiringSoon,
} from "./github-oauth";

// Save original fetch to restore after tests
const originalFetch = global.fetch;

// Mock fetch globally
const mockFetch = vi.fn();

describe("github-oauth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe("refreshGitHubToken", () => {
    it("should successfully refresh a GitHub token", async () => {
      const mockResponse = {
        access_token: "new_access_token",
        expires_in: 28800,
        refresh_token: "new_refresh_token",
        refresh_token_expires_in: 15897600,
        token_type: "bearer",
        scope: "repo,user",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await refreshGitHubToken({
        refreshToken: "old_refresh_token",
        clientId: "test_client_id",
        clientSecret: "test_client_secret",
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: expect.any(URLSearchParams),
        },
      );

      // Verify the body contains the correct params
      const callArgs = mockFetch.mock.calls[0]!;
      const body = callArgs[1]!.body as URLSearchParams;
      expect(body.get("client_id")).toBe("test_client_id");
      expect(body.get("client_secret")).toBe("test_client_secret");
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("old_refresh_token");
    });

    it("should throw an error when GitHub returns an error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: "bad_refresh_token",
          error_description: "The refresh token is invalid or expired",
        }),
      });

      await expect(
        refreshGitHubToken({
          refreshToken: "invalid_token",
          clientId: "test_client_id",
          clientSecret: "test_client_secret",
        }),
      ).rejects.toThrow("GitHub token refresh error: bad_refresh_token");
    });

    it("should throw an error when the HTTP response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(
        refreshGitHubToken({
          refreshToken: "some_token",
          clientId: "test_client_id",
          clientSecret: "test_client_secret",
        }),
      ).rejects.toThrow("GitHub token refresh failed: 500");
    });
  });

  describe("isTokenExpiredOrExpiringSoon", () => {
    it("should return false when no expiration date is set", () => {
      expect(isTokenExpiredOrExpiringSoon(null)).toBe(false);
    });

    it("should return false when token is not expired and not expiring soon", () => {
      // Token expires in 2 hours
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      expect(isTokenExpiredOrExpiringSoon(expiresAt)).toBe(false);
    });

    it("should return true when token is expired", () => {
      // Token expired 1 hour ago
      const expiresAt = new Date(Date.now() - 60 * 60 * 1000);
      expect(isTokenExpiredOrExpiringSoon(expiresAt)).toBe(true);
    });

    it("should return true when token is expiring soon (within buffer)", () => {
      // Token expires in 30 minutes (within 1-hour buffer)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      expect(isTokenExpiredOrExpiringSoon(expiresAt)).toBe(true);
    });

    it("should respect custom buffer time", () => {
      // Token expires in 2 hours
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      // With default 1-hour buffer, should not be expired
      expect(isTokenExpiredOrExpiringSoon(expiresAt)).toBe(false);

      // With 3-hour buffer, should be considered expiring soon
      const threeHourBuffer = 3 * 60 * 60 * 1000;
      expect(isTokenExpiredOrExpiringSoon(expiresAt, threeHourBuffer)).toBe(
        true,
      );
    });
  });
});
