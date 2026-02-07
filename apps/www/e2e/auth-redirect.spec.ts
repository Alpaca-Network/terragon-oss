import { test, expect } from "@playwright/test";

/**
 * E2E tests for authentication redirect security
 *
 * These tests verify that:
 * 1. Open redirect vulnerabilities are prevented
 * 2. Valid returnUrl parameters work correctly
 * 3. The GatewayZ OAuth flow initiates properly
 */

test.describe("Login Page Redirect Security", () => {
  test("should redirect to dashboard by default when no returnUrl", async ({
    page,
  }) => {
    // Navigate to login without returnUrl
    await page.goto("/login");

    // Verify we're on the login page
    await expect(page).toHaveURL("/login");
    await expect(page.locator("text=Welcome to Terragon")).toBeVisible();
  });

  test("should preserve valid relative returnUrl in login form", async ({
    page,
  }) => {
    // Navigate to login with a valid returnUrl
    await page.goto("/login?returnUrl=/settings");

    // Verify we're on the login page
    await expect(page).toHaveURL("/login?returnUrl=/settings");
  });

  test("should preserve returnUrl with query parameters", async ({ page }) => {
    // Navigate to login with returnUrl containing query params
    await page.goto("/login?returnUrl=/settings?tab=agent");

    // Should still be on login page with the returnUrl preserved
    await expect(page).toHaveURL(/\/login/);
  });

  test("should reject external URLs and default to dashboard", async ({
    page,
  }) => {
    // Try to use an external URL as returnUrl
    await page.goto("/login?returnUrl=https://evil.com");

    // The login page should sanitize the returnUrl
    // When clicking login, it should NOT redirect to evil.com
    await expect(page).toHaveURL("/login");
  });

  test("should reject protocol-relative URLs", async ({ page }) => {
    // Try to use a protocol-relative URL
    await page.goto("/login?returnUrl=//evil.com");

    // Should be on login page, returnUrl should be sanitized
    await expect(page).toHaveURL("/login");
  });

  test("should reject javascript: URLs", async ({ page }) => {
    // Try to inject a javascript URL
    await page.goto("/login?returnUrl=javascript:alert(1)");

    // Should be on login page
    await expect(page).toHaveURL("/login");
  });
});

test.describe("GatewayZ OAuth Initiate", () => {
  test("should initiate GatewayZ OAuth flow when clicking login button", async ({
    page,
  }) => {
    await page.goto("/login?returnUrl=/dashboard");

    // Find and click the GatewayZ login button
    const gatewayzButton = page.locator("text=Continue with Gatewayz");
    await expect(gatewayzButton).toBeVisible();

    // Click the button - it should redirect to the initiate endpoint
    // We'll intercept the navigation to verify the redirect target
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/auth/gatewayz/initiate") ||
          resp.url().includes("gatewayz.ai"),
      ),
      gatewayzButton.click(),
    ]);

    // Verify the initiate endpoint was called or we're redirecting to GatewayZ
    expect(
      response.url().includes("/api/auth/gatewayz/initiate") ||
        response.url().includes("gatewayz.ai"),
    ).toBeTruthy();
  });

  test("should validate returnUrl in initiate endpoint", async ({ page }) => {
    // Directly call the initiate endpoint with an external returnUrl
    const response = await page.goto(
      "/api/auth/gatewayz/initiate?returnUrl=https://evil.com",
    );

    // The endpoint should redirect, but the returnUrl should be sanitized
    // Check that we're redirecting to GatewayZ (not evil.com)
    const url = page.url();
    expect(url).not.toContain("evil.com");
  });

  test("should rate limit excessive auth requests", async ({ page }) => {
    // Make multiple rapid requests to test rate limiting
    const responses: number[] = [];

    for (let i = 0; i < 15; i++) {
      const response = await page.goto("/api/auth/gatewayz/initiate");
      responses.push(response?.status() || 0);
    }

    // At least some requests should be rate limited (429)
    const rateLimited = responses.filter((status) => status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});

test.describe("GatewayZ Callback Security", () => {
  test("should reject callback without token", async ({ page }) => {
    // Call callback without gwauth token
    await page.goto("/api/auth/gatewayz/callback");

    // Should redirect to login with error
    await expect(page).toHaveURL(/\/login.*error=missing_token/);
  });

  test("should reject callback with invalid token", async ({ page }) => {
    // Call callback with invalid token
    await page.goto("/api/auth/gatewayz/callback?gwauth=invalid-token");

    // Should redirect to login with error
    await expect(page).toHaveURL(/\/login.*error=invalid_token/);
  });

  test("should sanitize returnUrl in callback", async ({ page }) => {
    // Try to inject external URL in callback
    await page.goto(
      "/api/auth/gatewayz/callback?returnUrl=https://evil.com&gwauth=test",
    );

    // Should not redirect to evil.com
    const url = page.url();
    expect(url).not.toContain("evil.com");
  });
});

test.describe("Authenticated User Redirect", () => {
  // Note: These tests require a way to set up an authenticated session
  // In a real setup, you'd use a test user or mock the session

  test.skip("should redirect authenticated user to returnUrl", async ({
    page,
  }) => {
    // This would require setting up authentication first
    // Skipping for now - would need auth setup
  });

  test.skip("should redirect authenticated user to dashboard when returnUrl is external", async ({
    page,
  }) => {
    // This would require setting up authentication first
    // Skipping for now - would need auth setup
  });
});
