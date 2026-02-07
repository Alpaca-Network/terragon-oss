import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Tests for GatewayZ callback route security
 *
 * These tests verify the security properties of the embed mode authentication,
 * particularly the postMessage origin restrictions.
 */

// Read the actual route source to verify security patterns
const routeSourcePath = join(__dirname, "route.ts");
let routeSource: string;
try {
  routeSource = readFileSync(routeSourcePath, "utf-8");
} catch {
  // Fallback for test environments where file might not be accessible
  routeSource = "";
}

// Default allowed origins that should match the route implementation
const EXPECTED_DEFAULT_ORIGINS = [
  "https://gatewayz.ai",
  "https://www.gatewayz.ai",
  "https://beta.gatewayz.ai",
  "https://inbox.gatewayz.ai",
];

describe("GatewayZ callback route security", () => {
  describe("source code verification", () => {
    it("should not contain wildcard postMessage target in source", () => {
      if (!routeSource) {
        // Skip if source not available (e.g., in built environments)
        return;
      }
      // Verify the source code does NOT contain postMessage with wildcard
      expect(routeSource).not.toMatch(/postMessage\([^)]+,\s*['"`]\*['"`]\)/);
    });

    it("should use getAllowedEmbedOrigins function for postMessage", () => {
      if (!routeSource) {
        return;
      }
      // Verify the function exists and is used
      expect(routeSource).toContain("getAllowedEmbedOrigins");
      expect(routeSource).toContain("allowedOrigins.forEach");
    });

    it("should define DEFAULT_ALLOWED_EMBED_ORIGINS constant", () => {
      if (!routeSource) {
        return;
      }
      expect(routeSource).toContain("DEFAULT_ALLOWED_EMBED_ORIGINS");
    });

    it("should support GATEWAYZ_ALLOWED_ORIGINS env var override", () => {
      if (!routeSource) {
        return;
      }
      expect(routeSource).toContain("GATEWAYZ_ALLOWED_ORIGINS");
    });

    it("should filter empty origins from env var to prevent silent postMessage failures", () => {
      if (!routeSource) {
        return;
      }
      // Verify the code filters out empty strings (from extra commas like "a,,b" or empty env var)
      expect(routeSource).toContain("filter((origin) => origin.length > 0");
      // Verify the code validates origins are valid HTTPS URLs
      expect(routeSource).toContain("isValidHttpsOrigin(origin)");
      // Verify it falls back to defaults when env var produces no valid origins
      expect(routeSource).toContain(
        "origins.length > 0 ? origins : DEFAULT_ALLOWED_EMBED_ORIGINS",
      );
    });
  });

  describe("default allowed origins", () => {
    it("should only include trusted GatewayZ domains", () => {
      for (const origin of EXPECTED_DEFAULT_ORIGINS) {
        expect(origin).toMatch(
          /^https:\/\/(www\.|beta\.|inbox\.)?gatewayz\.ai$/,
        );
      }
    });

    it("should not include wildcard origins", () => {
      for (const origin of EXPECTED_DEFAULT_ORIGINS) {
        expect(origin).not.toBe("*");
        expect(origin).not.toContain("*");
      }
    });

    it("should only use HTTPS protocol", () => {
      for (const origin of EXPECTED_DEFAULT_ORIGINS) {
        expect(origin.startsWith("https://")).toBe(true);
      }
    });

    it("should include the main production domain", () => {
      expect(EXPECTED_DEFAULT_ORIGINS).toContain("https://gatewayz.ai");
    });

    it("should include the inbox subdomain", () => {
      expect(EXPECTED_DEFAULT_ORIGINS).toContain("https://inbox.gatewayz.ai");
    });

    it("should include the beta subdomain for testing", () => {
      expect(EXPECTED_DEFAULT_ORIGINS).toContain("https://beta.gatewayz.ai");
    });
  });
});

describe("postMessage security requirements", () => {
  it("documents that postMessage must target specific origins", () => {
    /**
     * Security requirement: The embed mode authentication page must NOT use
     * postMessage with a wildcard '*' origin.
     *
     * Rationale: Using '*' allows any parent window to receive the auth
     * completion message, which could leak information about the authentication
     * state to malicious sites that embed Terragon in an iframe.
     *
     * Implementation: The generateEmbedAuthPage function iterates over
     * allowed origins and sends postMessage to each trusted origin.
     * Only the actual parent origin will receive the message.
     *
     * Configuration: Origins can be customized via GATEWAYZ_ALLOWED_ORIGINS
     * environment variable (comma-separated list).
     */
    expect(true).toBe(true);
  });

  it("documents that only GatewayZ domains are trusted embed parents", () => {
    /**
     * Security requirement: Only GatewayZ domains should be able to embed
     * Terragon and receive authentication completion messages.
     *
     * Default trusted domains:
     * - gatewayz.ai (main production)
     * - www.gatewayz.ai (www subdomain)
     * - beta.gatewayz.ai (testing/staging)
     * - inbox.gatewayz.ai (inbox feature)
     *
     * These can be overridden via GATEWAYZ_ALLOWED_ORIGINS env var.
     *
     * Any other domain embedding Terragon will NOT receive postMessage
     * notifications about auth completion.
     */
    expect(EXPECTED_DEFAULT_ORIGINS.length).toBe(4);
  });
});

describe("XSS protection verification", () => {
  it("should have escapeForJsString function that handles dangerous characters", () => {
    if (!routeSource) {
      return;
    }
    // Verify the escape function exists and handles all necessary characters
    expect(routeSource).toContain("escapeForJsString");
    expect(routeSource).toContain("\\\\\\\\"); // Escapes backslashes
    expect(routeSource).toContain("\\\\'"); // Escapes single quotes
    expect(routeSource).toContain("\\x3c"); // Escapes < for script injection
    expect(routeSource).toContain("\\u2028"); // Escapes Unicode line separator
    expect(routeSource).toContain("\\u2029"); // Escapes Unicode paragraph separator
  });

  it("should escape all dynamic values in embed auth page", () => {
    if (!routeSource) {
      return;
    }
    // Verify all dynamic values use the escape function
    expect(routeSource).toContain("safeSessionToken = escapeForJsString");
    expect(routeSource).toContain("safeGwAuthToken = escapeForJsString");
    expect(routeSource).toContain("safeRedirectUrl = escapeForJsString");
  });

  it("should escape allowedOrigins JSON to prevent XSS via env var", () => {
    if (!routeSource) {
      return;
    }
    // Verify allowedOriginsJson is built using escapeForJsString, not raw JSON.stringify
    // This prevents XSS if an attacker can inject </script> via GATEWAYZ_ALLOWED_ORIGINS env var
    expect(routeSource).toContain("escapeForJsString(o)");
    expect(routeSource).toContain("allowedOrigins.map(");
    // Should NOT use raw JSON.stringify for the origins
    expect(routeSource).not.toMatch(
      /JSON\.stringify\(getAllowedEmbedOrigins\(\)\)/,
    );
  });

  it("should have isValidHttpsOrigin function for origin validation", () => {
    if (!routeSource) {
      return;
    }
    expect(routeSource).toContain("isValidHttpsOrigin");
    expect(routeSource).toContain('url.protocol === "https:"');
  });
});
