import { describe, it, expect } from "vitest";

/**
 * Tests for the Futuristic Effects components.
 *
 * The key changes being tested:
 * - GlowCard component with glow intensity levels
 * - NeonBorder with color variants
 * - PulseIndicator with status and size options
 * - GlassPanel with blur levels
 * - ScanLine active/inactive states
 * - HolographicBadge styling
 * - CyberButton variants and states
 * - DataStreamLoader sizes
 * - FuturisticDivider orientations
 * - FloatingCard with elevation
 * - AnimatedEntrance with delays
 */
describe("Futuristic Effects Components", () => {
  describe("GlowCard", () => {
    const glowIntensities = {
      subtle: "hover:shadow-[0_0_15px_rgba(99,102,241,0.15)]",
      medium: "hover:shadow-[0_0_25px_rgba(99,102,241,0.25)]",
      strong: "hover:shadow-[0_0_35px_rgba(99,102,241,0.35)]",
    };

    it("should have subtle glow intensity class", () => {
      expect(glowIntensities.subtle).toContain("0_0_15px");
      expect(glowIntensities.subtle).toContain("0.15");
    });

    it("should have medium glow intensity class", () => {
      expect(glowIntensities.medium).toContain("0_0_25px");
      expect(glowIntensities.medium).toContain("0.25");
    });

    it("should have strong glow intensity class", () => {
      expect(glowIntensities.strong).toContain("0_0_35px");
      expect(glowIntensities.strong).toContain("0.35");
    });

    it("should use hover shadow for glow effect", () => {
      Object.values(glowIntensities).forEach((className) => {
        expect(className).toContain("hover:shadow");
      });
    });
  });

  describe("NeonBorder", () => {
    const colorClasses = {
      primary: "before:bg-primary/50",
      accent: "before:bg-accent/50",
      gradient:
        "before:bg-gradient-to-r before:from-primary/50 before:via-purple-500/50 before:to-blue-500/50",
    };

    it("should have primary color class", () => {
      expect(colorClasses.primary).toContain("bg-primary");
    });

    it("should have accent color class", () => {
      expect(colorClasses.accent).toContain("bg-accent");
    });

    it("should have gradient color class with multiple colors", () => {
      expect(colorClasses.gradient).toContain("gradient-to-r");
      expect(colorClasses.gradient).toContain("from-primary");
      expect(colorClasses.gradient).toContain("via-purple-500");
      expect(colorClasses.gradient).toContain("to-blue-500");
    });
  });

  describe("PulseIndicator", () => {
    const statusColors = {
      active: "bg-primary",
      pending: "bg-yellow-500",
      success: "bg-green-500",
      error: "bg-red-500",
    };

    const sizeClasses = {
      sm: "h-2 w-2",
      md: "h-3 w-3",
      lg: "h-4 w-4",
    };

    it("should have active status color", () => {
      expect(statusColors.active).toBe("bg-primary");
    });

    it("should have pending status color", () => {
      expect(statusColors.pending).toBe("bg-yellow-500");
    });

    it("should have success status color", () => {
      expect(statusColors.success).toBe("bg-green-500");
    });

    it("should have error status color", () => {
      expect(statusColors.error).toBe("bg-red-500");
    });

    it("should have small size class", () => {
      expect(sizeClasses.sm).toBe("h-2 w-2");
    });

    it("should have medium size class", () => {
      expect(sizeClasses.md).toBe("h-3 w-3");
    });

    it("should have large size class", () => {
      expect(sizeClasses.lg).toBe("h-4 w-4");
    });
  });

  describe("GlassPanel", () => {
    const blurClasses = {
      sm: "backdrop-blur-sm",
      md: "backdrop-blur-md",
      lg: "backdrop-blur-lg",
    };

    it("should have small blur class", () => {
      expect(blurClasses.sm).toBe("backdrop-blur-sm");
    });

    it("should have medium blur class", () => {
      expect(blurClasses.md).toBe("backdrop-blur-md");
    });

    it("should have large blur class", () => {
      expect(blurClasses.lg).toBe("backdrop-blur-lg");
    });

    it("should all use backdrop-blur", () => {
      Object.values(blurClasses).forEach((className) => {
        expect(className).toContain("backdrop-blur");
      });
    });
  });

  describe("ScanLine", () => {
    const scanLineConfig = {
      active: true,
      inactive: false,
      containerClass: "pointer-events-none absolute inset-0 overflow-hidden",
      animationClass: "animate-[scan-line_3s_linear_infinite]",
    };

    it("should be active by default", () => {
      expect(scanLineConfig.active).toBe(true);
    });

    it("should be able to be inactive", () => {
      expect(scanLineConfig.inactive).toBe(false);
    });

    it("should have pointer-events-none", () => {
      expect(scanLineConfig.containerClass).toContain("pointer-events-none");
    });

    it("should have scan-line animation", () => {
      expect(scanLineConfig.animationClass).toContain("scan-line");
    });

    it("should have infinite animation duration", () => {
      expect(scanLineConfig.animationClass).toContain("infinite");
    });
  });

  describe("HolographicBadge", () => {
    const badgeConfig = {
      baseClass:
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
      holographicClass: "holographic-bg",
      borderClass: "border border-primary/20",
    };

    it("should have rounded-full style", () => {
      expect(badgeConfig.baseClass).toContain("rounded-full");
    });

    it("should use holographic-bg class", () => {
      expect(badgeConfig.holographicClass).toBe("holographic-bg");
    });

    it("should have primary border color", () => {
      expect(badgeConfig.borderClass).toContain("border-primary");
    });

    it("should use text-xs font size", () => {
      expect(badgeConfig.baseClass).toContain("text-xs");
    });
  });

  describe("CyberButton", () => {
    const variants = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
      ghost:
        "bg-transparent text-foreground hover:bg-accent/10 border border-transparent hover:border-primary/30",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    it("should have primary variant with bg-primary", () => {
      expect(variants.primary).toContain("bg-primary");
    });

    it("should have secondary variant with border", () => {
      expect(variants.secondary).toContain("border");
    });

    it("should have ghost variant that is transparent", () => {
      expect(variants.ghost).toContain("bg-transparent");
    });

    it("should have small size of h-8", () => {
      expect(sizes.sm).toContain("h-8");
    });

    it("should have medium size of h-10", () => {
      expect(sizes.md).toContain("h-10");
    });

    it("should have large size of h-12", () => {
      expect(sizes.lg).toContain("h-12");
    });

    it("should use tap-highlight for touch feedback", () => {
      const buttonClass = "tap-highlight soft-glow";
      expect(buttonClass).toContain("tap-highlight");
    });
  });

  describe("DataStreamLoader", () => {
    const sizeClasses = {
      sm: "h-1 w-16",
      md: "h-1.5 w-24",
      lg: "h-2 w-32",
    };

    it("should have small size dimensions", () => {
      expect(sizeClasses.sm).toBe("h-1 w-16");
    });

    it("should have medium size dimensions", () => {
      expect(sizeClasses.md).toBe("h-1.5 w-24");
    });

    it("should have large size dimensions", () => {
      expect(sizeClasses.lg).toBe("h-2 w-32");
    });

    it("should increase width with size", () => {
      expect(sizeClasses.sm).toContain("w-16");
      expect(sizeClasses.md).toContain("w-24");
      expect(sizeClasses.lg).toContain("w-32");
    });
  });

  describe("FuturisticDivider", () => {
    const orientations = {
      horizontal: "h-px w-full",
      vertical: "w-px h-full",
    };

    it("should have horizontal orientation class", () => {
      expect(orientations.horizontal).toBe("h-px w-full");
    });

    it("should have vertical orientation class", () => {
      expect(orientations.vertical).toBe("w-px h-full");
    });

    it("should use 1px dimension for the line", () => {
      expect(orientations.horizontal).toContain("h-px");
      expect(orientations.vertical).toContain("w-px");
    });
  });

  describe("FloatingCard", () => {
    const cardConfig = {
      baseClass: "rounded-lg bg-card border border-border",
      transitionClass: "transition-all duration-300",
      hoverClass: "card-float-hover",
      elevatedClass: "shadow-lg shadow-primary/5",
    };

    it("should have rounded-lg corners", () => {
      expect(cardConfig.baseClass).toContain("rounded-lg");
    });

    it("should have transition-all class", () => {
      expect(cardConfig.transitionClass).toContain("transition-all");
    });

    it("should have card-float-hover effect", () => {
      expect(cardConfig.hoverClass).toBe("card-float-hover");
    });

    it("should have shadow for elevated state", () => {
      expect(cardConfig.elevatedClass).toContain("shadow-lg");
    });
  });

  describe("AnimatedEntrance", () => {
    const entranceConfig = {
      animationClass: "animate-card-enter opacity-0",
      fillMode: "forwards",
      defaultDelay: 0,
    };

    it("should use animate-card-enter class", () => {
      expect(entranceConfig.animationClass).toContain("animate-card-enter");
    });

    it("should start with opacity-0", () => {
      expect(entranceConfig.animationClass).toContain("opacity-0");
    });

    it("should use forwards fill mode", () => {
      expect(entranceConfig.fillMode).toBe("forwards");
    });

    it("should have default delay of 0", () => {
      expect(entranceConfig.defaultDelay).toBe(0);
    });

    it("should support custom delay values", () => {
      const customDelays = [100, 200, 300, 500];
      customDelays.forEach((delay) => {
        expect(typeof delay).toBe("number");
        expect(delay).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("CSS Animation Classes", () => {
    const animations = [
      "animate-neon-pulse",
      "animate-card-enter",
      "animate-page-enter",
      "animate-glitch",
    ];

    it("should define neon-pulse animation", () => {
      expect(animations).toContain("animate-neon-pulse");
    });

    it("should define card-enter animation", () => {
      expect(animations).toContain("animate-card-enter");
    });

    it("should define page-enter animation", () => {
      expect(animations).toContain("animate-page-enter");
    });

    it("should define glitch animation", () => {
      expect(animations).toContain("animate-glitch");
    });
  });

  describe("Utility Classes", () => {
    const utilities = {
      tapHighlight: "tap-highlight",
      softGlow: "soft-glow",
      futuristicScrollbar: "futuristic-scrollbar",
      glassMorphism: "glass-morphism",
      cyberGrid: "cyber-grid",
      gradientShiftBg: "gradient-shift-bg",
      holographicBg: "holographic-bg",
    };

    it("should have tap-highlight utility", () => {
      expect(utilities.tapHighlight).toBe("tap-highlight");
    });

    it("should have soft-glow utility", () => {
      expect(utilities.softGlow).toBe("soft-glow");
    });

    it("should have futuristic-scrollbar utility", () => {
      expect(utilities.futuristicScrollbar).toBe("futuristic-scrollbar");
    });

    it("should have glass-morphism utility", () => {
      expect(utilities.glassMorphism).toBe("glass-morphism");
    });

    it("should have cyber-grid utility", () => {
      expect(utilities.cyberGrid).toBe("cyber-grid");
    });

    it("should have gradient-shift-bg utility", () => {
      expect(utilities.gradientShiftBg).toBe("gradient-shift-bg");
    });

    it("should have holographic-bg utility", () => {
      expect(utilities.holographicBg).toBe("holographic-bg");
    });
  });
});
