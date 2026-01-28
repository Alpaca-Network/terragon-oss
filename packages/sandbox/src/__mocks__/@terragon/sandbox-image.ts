// Mock for @terragon/sandbox-image - used in tests when the actual package isn't built
import type { SandboxProvider, SandboxSize } from "@terragon/types/sandbox";

export function getTemplateIdForSize(
  provider: SandboxProvider,
  size: SandboxSize,
): string {
  // Return mock template IDs for testing
  if (provider === "e2b") {
    return size === "large"
      ? "mock-e2b-large-template"
      : "mock-e2b-small-template";
  }
  if (provider === "daytona") {
    return size === "large"
      ? "mock-daytona-large-template"
      : "mock-daytona-small-template";
  }
  return "mock-template";
}
