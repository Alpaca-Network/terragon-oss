import { describe, it, expect } from "vitest";
import { validateReturnUrl } from "./url-validation";

describe("validateReturnUrl", () => {
  const baseUrl = "https://www.terragonlabs.com";

  describe("valid return URLs", () => {
    it("should allow relative paths starting with /", () => {
      expect(validateReturnUrl("/dashboard", baseUrl)).toBe("/dashboard");
      expect(validateReturnUrl("/settings/agent", baseUrl)).toBe(
        "/settings/agent",
      );
      expect(validateReturnUrl("/threads/123", baseUrl)).toBe("/threads/123");
    });

    it("should allow relative paths with query strings", () => {
      expect(validateReturnUrl("/dashboard?tab=settings", baseUrl)).toBe(
        "/dashboard?tab=settings",
      );
      expect(
        validateReturnUrl("/settings?gatewayz_connected=true", baseUrl),
      ).toBe("/settings?gatewayz_connected=true");
    });

    it("should allow same-origin absolute URLs", () => {
      expect(
        validateReturnUrl("https://www.terragonlabs.com/dashboard", baseUrl),
      ).toBe("/dashboard");
      expect(
        validateReturnUrl(
          "https://www.terragonlabs.com/settings?tab=agent",
          baseUrl,
        ),
      ).toBe("/settings?tab=agent");
    });

    it("should preserve query parameters from same-origin URLs", () => {
      expect(
        validateReturnUrl(
          "https://www.terragonlabs.com/callback?code=abc&state=xyz",
          baseUrl,
        ),
      ).toBe("/callback?code=abc&state=xyz");
    });
  });

  describe("invalid return URLs - should default to /dashboard", () => {
    it("should reject empty strings", () => {
      expect(validateReturnUrl("", baseUrl)).toBe("/dashboard");
    });

    it("should reject protocol-relative URLs (//evil.com)", () => {
      expect(validateReturnUrl("//evil.com", baseUrl)).toBe("/dashboard");
      expect(validateReturnUrl("//evil.com/path", baseUrl)).toBe("/dashboard");
    });

    it("should reject external absolute URLs", () => {
      expect(validateReturnUrl("https://evil.com", baseUrl)).toBe("/dashboard");
      expect(validateReturnUrl("https://evil.com/phishing", baseUrl)).toBe(
        "/dashboard",
      );
      expect(
        validateReturnUrl("https://www.evil.com/steal-creds", baseUrl),
      ).toBe("/dashboard");
    });

    it("should reject URLs with different ports as cross-origin", () => {
      expect(
        validateReturnUrl(
          "https://www.terragonlabs.com:8080/dashboard",
          baseUrl,
        ),
      ).toBe("/dashboard");
    });

    it("should reject URLs with different protocols", () => {
      expect(
        validateReturnUrl("http://www.terragonlabs.com/dashboard", baseUrl),
      ).toBe("/dashboard");
    });

    it("should reject javascript: URLs", () => {
      expect(validateReturnUrl("javascript:alert(1)", baseUrl)).toBe(
        "/dashboard",
      );
    });

    it("should reject data: URLs", () => {
      expect(
        validateReturnUrl("data:text/html,<script>alert(1)</script>", baseUrl),
      ).toBe("/dashboard");
    });

    it("should reject URLs with credentials", () => {
      expect(
        validateReturnUrl("https://user:pass@evil.com/path", baseUrl),
      ).toBe("/dashboard");
    });

    it("should reject malformed URLs", () => {
      expect(validateReturnUrl("not-a-valid-url", baseUrl)).toBe("/dashboard");
      expect(validateReturnUrl("://missing-protocol", baseUrl)).toBe(
        "/dashboard",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle relative URLs with fragments", () => {
      expect(validateReturnUrl("/dashboard#section", baseUrl)).toBe(
        "/dashboard#section",
      );
    });

    it("should preserve fragments from same-origin absolute URLs", () => {
      expect(
        validateReturnUrl("https://www.terragonlabs.com/page#section", baseUrl),
      ).toBe("/page#section");
      expect(
        validateReturnUrl(
          "https://www.terragonlabs.com/settings?tab=agent#advanced",
          baseUrl,
        ),
      ).toBe("/settings?tab=agent#advanced");
    });

    it("should handle encoded characters in paths", () => {
      expect(validateReturnUrl("/path%20with%20spaces", baseUrl)).toBe(
        "/path%20with%20spaces",
      );
    });

    it("should handle complex query strings", () => {
      expect(
        validateReturnUrl("/callback?returnUrl=%2Fdashboard&code=abc", baseUrl),
      ).toBe("/callback?returnUrl=%2Fdashboard&code=abc");
    });

    it("should handle different base URLs correctly", () => {
      const devBaseUrl = "http://localhost:3000";
      expect(
        validateReturnUrl("http://localhost:3000/dashboard", devBaseUrl),
      ).toBe("/dashboard");
      expect(
        validateReturnUrl("https://www.terragonlabs.com/dashboard", devBaseUrl),
      ).toBe("/dashboard"); // Cross-origin, should reject
    });
  });

  describe("attack vectors", () => {
    it("should prevent open redirect via URL encoding", () => {
      // Encoded forward slashes shouldn't bypass the check
      expect(validateReturnUrl("%2F%2Fevil.com", baseUrl)).toBe("/dashboard");
    });

    it("should prevent open redirect via backslash", () => {
      // Some browsers treat backslash as forward slash
      expect(validateReturnUrl("\\\\evil.com", baseUrl)).toBe("/dashboard");
      expect(validateReturnUrl("/\\evil.com", baseUrl)).toBe("/\\evil.com"); // This is a valid relative path
    });

    it("should prevent redirect via @ symbol in path", () => {
      expect(
        validateReturnUrl("https://evil.com@terragonlabs.com", baseUrl),
      ).toBe("/dashboard");
    });

    it("should prevent subdomain attacks", () => {
      expect(
        validateReturnUrl("https://evil.terragonlabs.com/path", baseUrl),
      ).toBe("/dashboard");
      expect(
        validateReturnUrl("https://terragonlabs.com.evil.com/path", baseUrl),
      ).toBe("/dashboard");
    });
  });
});
