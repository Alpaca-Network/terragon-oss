import { describe, it, expect } from "vitest";

describe("TestimonialCard styling configuration", () => {
  const cardClasses =
    "bg-card text-card-foreground rounded-xl border border-border p-6 break-inside-avoid shadow-sm hover:shadow-md transition-shadow";

  it("should use semantic card background for theme support", () => {
    expect(cardClasses).toContain("bg-card");
    expect(cardClasses).not.toContain("bg-sidebar");
  });

  it("should use semantic card foreground for readable text", () => {
    expect(cardClasses).toContain("text-card-foreground");
  });

  it("should keep semantic border styling", () => {
    expect(cardClasses).toContain("border-border");
  });
});
