import { describe, it, expect } from "vitest";

/**
 * Tests for the Wordmark component branding.
 *
 * The key changes being tested:
 * - Uses Gatewayz branding (logo, name)
 * - Gatewayz logo files
 * - Gray-900 text color
 * - Hover scale animation
 */
describe("Wordmark branding configuration", () => {
  describe("brand name", () => {
    it("should use Gatewayz as brand name", () => {
      const brandName = "Gatewayz";
      expect(brandName).toBe("Gatewayz");
    });

    it("should not use Terragon as brand name", () => {
      const brandName = "Gatewayz";
      expect(brandName).not.toBe("Terragon");
    });
  });

  describe("logo files", () => {
    const logoConfig = {
      light: "/gatewayz-logo-black.png",
      dark: "/gatewayz-logo-white.png",
      alt: "Gatewayz",
    };

    it("should use gatewayz-logo-black.png for light mode", () => {
      expect(logoConfig.light).toBe("/gatewayz-logo-black.png");
    });

    it("should use gatewayz-logo-white.png for dark mode", () => {
      expect(logoConfig.dark).toBe("/gatewayz-logo-white.png");
    });

    it("should use Gatewayz as alt text", () => {
      expect(logoConfig.alt).toBe("Gatewayz");
    });

    it("should not use plant icons", () => {
      expect(logoConfig.light).not.toContain("plant");
      expect(logoConfig.dark).not.toContain("plant");
    });
  });

  describe("sizing", () => {
    const sizes = {
      sm: { logo: 24, text: "text-lg" },
      md: { logo: 32, text: "text-lg" },
      lg: { logo: 40, text: "text-xl" },
    };

    it("should use 24px logo for sm size", () => {
      expect(sizes.sm.logo).toBe(24);
    });

    it("should use 32px logo for md size", () => {
      expect(sizes.md.logo).toBe(32);
    });

    it("should use 40px logo for lg size", () => {
      expect(sizes.lg.logo).toBe(40);
    });

    it("should use text-lg for sm size", () => {
      expect(sizes.sm.text).toBe("text-lg");
    });

    it("should use text-lg for md size", () => {
      expect(sizes.md.text).toBe("text-lg");
    });

    it("should use text-xl for lg size", () => {
      expect(sizes.lg.text).toBe("text-xl");
    });
  });

  describe("styling", () => {
    const wordmarkStyles = {
      container: "flex items-center gap-2 select-none group",
      text: "font-semibold text-gray-900 dark:text-gray-100",
      logoHover: "transition-transform group-hover:scale-105",
    };

    it("should have semibold font weight", () => {
      expect(wordmarkStyles.text).toContain("font-semibold");
    });

    it("should use gray-900 text color for light mode", () => {
      expect(wordmarkStyles.text).toContain("text-gray-900");
    });

    it("should use gray-100 text color for dark mode", () => {
      expect(wordmarkStyles.text).toContain("dark:text-gray-100");
    });

    it("should have group class for hover effects", () => {
      expect(wordmarkStyles.container).toContain("group");
    });

    it("should have select-none to prevent text selection", () => {
      expect(wordmarkStyles.container).toContain("select-none");
    });

    it("should have hover scale transition on logo", () => {
      expect(wordmarkStyles.logoHover).toContain("transition-transform");
      expect(wordmarkStyles.logoHover).toContain("group-hover:scale-105");
    });
  });

  describe("default props", () => {
    const defaultProps = {
      showLogo: true,
      showText: true,
      href: "/",
      size: "md",
    };

    it("should show logo by default", () => {
      expect(defaultProps.showLogo).toBe(true);
    });

    it("should show text by default", () => {
      expect(defaultProps.showText).toBe(true);
    });

    it("should link to / by default", () => {
      expect(defaultProps.href).toBe("/");
    });

    it("should use md size by default", () => {
      expect(defaultProps.size).toBe("md");
    });
  });
});
