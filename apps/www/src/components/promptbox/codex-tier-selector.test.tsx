import { describe, it, expect } from "vitest";
import type { CodexTier } from "@terragon/shared/db/types";
import { tierConfig } from "./codex-tier-selector";

describe("CodexTier configuration", () => {
  it("has all expected tier keys", () => {
    const expectedTiers: CodexTier[] = [
      "none",
      "low",
      "medium",
      "high",
      "xhigh",
    ];
    const configKeys = Object.keys(tierConfig);

    expect(configKeys).toEqual(expectedTiers);
  });

  it("all tiers have required fields", () => {
    for (const [, config] of Object.entries(tierConfig)) {
      expect(config).toHaveProperty("label");
      expect(config).toHaveProperty("shortLabel");
      expect(config).toHaveProperty("description");
      expect(typeof config.label).toBe("string");
      expect(typeof config.shortLabel).toBe("string");
      expect(typeof config.description).toBe("string");
    }
  });

  it("default tier is medium", () => {
    const defaultTier: CodexTier = "medium";
    expect(tierConfig[defaultTier]).toBeDefined();
    expect(tierConfig[defaultTier].label).toBe("Medium");
  });

  it("tier labels are descriptive", () => {
    expect(tierConfig.none.description).toContain("fastest");
    expect(tierConfig.low.description).toContain("quick");
    expect(tierConfig.medium.description).toContain("Balanced");
    expect(tierConfig.high.description).toContain("Thorough");
    expect(tierConfig.xhigh.description).toContain("Extended");
  });

  it("tier order is from least to most reasoning", () => {
    const orderedTiers: CodexTier[] = [
      "none",
      "low",
      "medium",
      "high",
      "xhigh",
    ];
    const configKeys = Object.keys(tierConfig) as CodexTier[];

    for (let i = 0; i < orderedTiers.length; i++) {
      expect(configKeys[i]).toBe(orderedTiers[i]);
    }
  });
});
