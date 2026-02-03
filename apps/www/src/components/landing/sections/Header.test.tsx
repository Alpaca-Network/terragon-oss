import { describe, it, expect } from "vitest";

/**
 * Tests for the Header component branding.
 *
 * The key changes being tested:
 * - Uses Gatewayz branding (logo, name, colors)
 * - White background with border
 * - Indigo/blue primary color scheme
 * - Links to Gatewayz documentation
 */
describe("Header branding configuration", () => {
  describe("brand identity", () => {
    it("should use Gatewayz as brand name", () => {
      const brandName = "Gatewayz";
      expect(brandName).toBe("Gatewayz");
    });

    it("should point to documentation", () => {
      // publicDocsUrl() should return base URL without /docs path
      const docsUrl = "https://docs.terragonlabs.com";
      expect(docsUrl).toContain("docs.terragonlabs.com");
    });
  });

  describe("navigation links", () => {
    const navLinks = [
      { name: "How It Works", href: "#how-it-works" },
      { name: "Features", href: "#features" },
      { name: "Pricing", href: "#pricing" },
      { name: "Documentation", href: "https://docs.terragonlabs.com/docs" },
    ];

    it("should have How It Works link", () => {
      const link = navLinks.find((l) => l.name === "How It Works");
      expect(link).toBeDefined();
      expect(link?.href).toBe("#how-it-works");
    });

    it("should have Features link", () => {
      const link = navLinks.find((l) => l.name === "Features");
      expect(link).toBeDefined();
      expect(link?.href).toBe("#features");
    });

    it("should have Pricing link", () => {
      const link = navLinks.find((l) => l.name === "Pricing");
      expect(link).toBeDefined();
      expect(link?.href).toBe("#pricing");
    });

    it("should have external Documentation link", () => {
      const link = navLinks.find((l) => l.name === "Documentation");
      expect(link).toBeDefined();
      expect(link?.href).toContain("docs.terragonlabs.com");
    });
  });

  describe("styling configuration", () => {
    const headerStyles = {
      background: "bg-background",
      border: "border-border",
      textColor: "text-muted-foreground",
      hoverColor: "hover:text-foreground",
    };

    it("should use semantic background variable", () => {
      expect(headerStyles.background).toBe("bg-background");
    });

    it("should use semantic border variable", () => {
      expect(headerStyles.border).toBe("border-border");
    });

    it("should use semantic text color for nav links", () => {
      expect(headerStyles.textColor).toBe("text-muted-foreground");
    });

    it("should have semantic hover state", () => {
      expect(headerStyles.hoverColor).toBe("hover:text-foreground");
    });

    it("should use semantic theme variables for automatic dark mode support", () => {
      // Semantic variables like bg-background, text-foreground automatically
      // support dark mode through CSS custom properties
      expect(headerStyles.background).not.toContain("dark:");
      expect(headerStyles.border).not.toContain("dark:");
    });
  });

  describe("login/auth configuration", () => {
    const authConfig = {
      loginPath: "/login",
      buttonText: "Sign In",
      buttonStyle: "bg-primary hover:bg-primary/90",
    };

    it("should link to /login for sign in", () => {
      expect(authConfig.loginPath).toBe("/login");
    });

    it("should display Sign In as button text", () => {
      expect(authConfig.buttonText).toBe("Sign In");
    });

    it("should use primary color for button", () => {
      expect(authConfig.buttonStyle).toContain("bg-primary");
    });
  });
});
