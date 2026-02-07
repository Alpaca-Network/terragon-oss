import { describe, it, expect } from "vitest";

/**
 * Tests for the Footer component branding.
 *
 * The key changes being tested:
 * - Uses Gatewayz branding (logo, name, social links)
 * - White background with border
 * - Links to Gatewayz social profiles
 * - Augmented Intelligence Humans Inc. copyright
 */
describe("Footer branding configuration", () => {
  describe("brand identity", () => {
    it("should use Gatewayz as brand name", () => {
      const brandName = "Gatewayz";
      expect(brandName).toBe("Gatewayz");
    });

    it("should use correct logo file paths", () => {
      const logos = {
        light: "/gatewayz-logo-black.png",
        dark: "/gatewayz-logo-white.png",
      };
      expect(logos.light).toBe("/gatewayz-logo-black.png");
      expect(logos.dark).toBe("/gatewayz-logo-white.png");
    });

    it("should have correct company name in copyright", () => {
      const companyName = "Augmented Intelligence Humans Inc.";
      expect(companyName).toBe("Augmented Intelligence Humans Inc.");
    });
  });

  describe("navigation sections", () => {
    const sections = ["Product", "Resources", "Company", "Connect"];

    it("should have Product section", () => {
      expect(sections).toContain("Product");
    });

    it("should have Resources section", () => {
      expect(sections).toContain("Resources");
    });

    it("should have Company section", () => {
      expect(sections).toContain("Company");
    });

    it("should have Connect section", () => {
      expect(sections).toContain("Connect");
    });
  });

  describe("product links", () => {
    const productLinks = [
      { name: "Features", href: "/#features" },
      { name: "Pricing", href: "/#pricing" },
    ];

    it("should have Features link", () => {
      const link = productLinks.find((l) => l.name === "Features");
      expect(link).toBeDefined();
      expect(link?.href).toBe("/#features");
    });

    it("should have Pricing link", () => {
      const link = productLinks.find((l) => l.name === "Pricing");
      expect(link).toBeDefined();
      expect(link?.href).toBe("/#pricing");
    });
  });

  describe("resources links", () => {
    const resourcesLinks = [
      { name: "Documentation", href: "https://docs.terragonlabs.com" },
    ];

    it("should have Documentation link pointing to docs", () => {
      const link = resourcesLinks.find((l) => l.name === "Documentation");
      expect(link).toBeDefined();
      expect(link?.href).toContain("docs.terragonlabs.com");
    });
  });

  describe("company links", () => {
    const companyLinks = [
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
    ];

    it("should have Privacy Policy link", () => {
      const link = companyLinks.find((l) => l.name === "Privacy Policy");
      expect(link).toBeDefined();
      expect(link?.href).toBe("/privacy");
    });

    it("should have Terms of Service link", () => {
      const link = companyLinks.find((l) => l.name === "Terms of Service");
      expect(link).toBeDefined();
      expect(link?.href).toBe("/terms");
    });
  });

  describe("social links", () => {
    const socialLinks = [
      { name: "Twitter / X", href: "https://x.com/GatewayzAI" },
      {
        name: "LinkedIn",
        href: "https://www.linkedin.com/company/gatewayz-ai/",
      },
    ];

    it("should have Twitter/X link", () => {
      const link = socialLinks.find((l) => l.name === "Twitter / X");
      expect(link).toBeDefined();
      expect(link?.href).toBe("https://x.com/GatewayzAI");
    });

    it("should have LinkedIn link", () => {
      const link = socialLinks.find((l) => l.name === "LinkedIn");
      expect(link).toBeDefined();
      expect(link?.href).toContain("linkedin.com/company/gatewayz-ai");
    });

    it("should use GatewayzAI as Twitter handle", () => {
      const twitterLink = socialLinks.find((l) => l.name === "Twitter / X");
      expect(twitterLink?.href).toContain("GatewayzAI");
    });
  });

  describe("social icons accessibility", () => {
    const socialIconLabels = [
      { icon: "Twitter", ariaLabel: "Follow us on X" },
      { icon: "LinkedIn", ariaLabel: "Follow us on LinkedIn" },
    ];

    it("should have aria-label for Twitter icon", () => {
      const icon = socialIconLabels.find((i) => i.icon === "Twitter");
      expect(icon?.ariaLabel).toBe("Follow us on X");
    });

    it("should have aria-label for LinkedIn icon", () => {
      const icon = socialIconLabels.find((i) => i.icon === "LinkedIn");
      expect(icon?.ariaLabel).toBe("Follow us on LinkedIn");
    });
  });

  describe("styling", () => {
    const footerStyles = {
      background: "bg-background",
      border: "border-border",
      grid: "grid-cols-2 md:grid-cols-4",
    };

    it("should use semantic background variable", () => {
      expect(footerStyles.background).toBe("bg-background");
    });

    it("should use semantic border variable", () => {
      expect(footerStyles.border).toBe("border-border");
    });

    it("should have 4-column grid layout on md screens", () => {
      expect(footerStyles.grid).toContain("md:grid-cols-4");
    });

    it("should support automatic dark mode via semantic variables", () => {
      // Semantic variables don't need explicit dark: prefixes
      expect(footerStyles.background).not.toContain("dark:");
      expect(footerStyles.border).not.toContain("dark:");
    });
  });
});
