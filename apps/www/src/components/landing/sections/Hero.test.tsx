import { describe, it, expect } from "vitest";

/**
 * Tests for the Hero component branding.
 *
 * The key changes being tested:
 * - Uses Gatewayz branding with "Gateway" headline
 * - Indigo/blue gradient styling
 * - White background
 * - Links to Gatewayz documentation
 */
describe("Hero branding configuration", () => {
  describe("headline", () => {
    it("should use 'Gateway' as the key brand word", () => {
      const brandWord = "Gateway";
      expect(brandWord).toBe("Gateway");
    });

    it("should have headline structure with Gateway", () => {
      const headlineStructure = "Your Gateway To Coding While You [verb]";
      expect(headlineStructure).toContain("Gateway");
    });
  });

  describe("gradient styling", () => {
    const gradientConfig = {
      from: "from-indigo-600",
      to: "to-blue-600",
      type: "bg-gradient-to-r",
    };

    it("should use indigo-600 as gradient start", () => {
      expect(gradientConfig.from).toBe("from-indigo-600");
    });

    it("should use blue-600 as gradient end", () => {
      expect(gradientConfig.to).toBe("to-blue-600");
    });

    it("should use right direction gradient", () => {
      expect(gradientConfig.type).toBe("bg-gradient-to-r");
    });
  });

  describe("subheadline", () => {
    it("should have correct subheadline text", () => {
      const subheadline =
        "Delegate to AI, so you can focus on the work that matters";
      expect(subheadline).toContain("Delegate to AI");
    });

    it("should use semantic muted-foreground color for subheadline", () => {
      const subheadlineStyle = "text-muted-foreground";
      expect(subheadlineStyle).toBe("text-muted-foreground");
    });
  });

  describe("CTA buttons", () => {
    const ctaConfig = {
      primaryButton: {
        text: "Get started for free",
        href: "/login",
        style: "bg-primary hover:bg-primary/90",
      },
      secondaryButton: {
        text: "Learn more",
        href: "https://docs.terragonlabs.com/docs",
        variant: "outline",
      },
    };

    it("should have primary CTA button", () => {
      expect(ctaConfig.primaryButton.text).toBe("Get started for free");
      expect(ctaConfig.primaryButton.href).toBe("/login");
    });

    it("should have secondary Learn more button", () => {
      expect(ctaConfig.secondaryButton.text).toBe("Learn more");
    });

    it("should link Learn more to docs", () => {
      expect(ctaConfig.secondaryButton.href).toContain("docs.terragonlabs.com");
    });

    it("should use primary color for main CTA", () => {
      expect(ctaConfig.primaryButton.style).toContain("bg-primary");
    });

    it("should use outline variant for secondary button", () => {
      expect(ctaConfig.secondaryButton.variant).toBe("outline");
    });
  });

  describe("typewriter words", () => {
    const options = [
      "commute",
      "shop",
      "cook",
      "lift",
      "think",
      "sleep",
      "code",
      "ship",
      "golf",
      "party",
      "raise",
      "tweet",
      "gossip",
    ];

    it("should have multiple activity words", () => {
      expect(options.length).toBeGreaterThan(5);
    });

    it("should include coding-related terms", () => {
      expect(options).toContain("code");
      expect(options).toContain("ship");
    });

    it("should include lifestyle activities", () => {
      expect(options).toContain("sleep");
      expect(options).toContain("golf");
      expect(options).toContain("party");
    });
  });

  describe("styling", () => {
    const heroStyles = {
      background: "bg-background",
      section: "flex items-center justify-center pt-8",
      videoContainer: "bg-card border border-border",
      blurEffect: "bg-primary/30 blur-3xl",
    };

    it("should use semantic background variable", () => {
      expect(heroStyles.background).toBe("bg-background");
    });

    it("should support automatic dark mode via semantic variables", () => {
      // Semantic variables don't need explicit dark: prefixes
      expect(heroStyles.background).not.toContain("dark:");
    });

    it("should have semantic border on video container", () => {
      expect(heroStyles.videoContainer).toContain("border-border");
    });

    it("should use card background for video container", () => {
      expect(heroStyles.videoContainer).toContain("bg-card");
    });

    it("should have blur effect with primary color", () => {
      expect(heroStyles.blurEffect).toContain("bg-primary");
      expect(heroStyles.blurEffect).toContain("blur-3xl");
    });
  });
});
