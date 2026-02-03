/**
 * Context Merge Utility
 *
 * Merges custom system prompt (global user setting) with smart-generated
 * context (per-repository). The smart context provides project-specific
 * conventions while custom prompt allows user overrides.
 */

export interface MergeContextOptions {
  /**
   * Global custom system prompt from user settings
   */
  customSystemPrompt?: string | null;

  /**
   * Per-repository smart-generated context
   */
  smartContext?: string | null;
}

/**
 * Merge custom system prompt with smart-generated context.
 *
 * Merging strategy:
 * - If only one exists, return that one
 * - If both exist, smart context comes first (project setup),
 *   then custom prompt under "Custom Instructions" (user overrides)
 *
 * @returns Merged content or null if both are empty
 */
export function mergeContextContent({
  customSystemPrompt,
  smartContext,
}: MergeContextOptions): string | null {
  const hasCustomPrompt = customSystemPrompt && customSystemPrompt.trim();
  const hasSmartContext = smartContext && smartContext.trim();

  // Neither exists
  if (!hasCustomPrompt && !hasSmartContext) {
    return null;
  }

  // Only smart context exists
  if (!hasCustomPrompt && hasSmartContext) {
    return smartContext!.trim();
  }

  // Only custom prompt exists
  if (hasCustomPrompt && !hasSmartContext) {
    return customSystemPrompt!.trim();
  }

  // Both exist - merge with smart context first
  return `${smartContext!.trim()}

---

## Custom Instructions

${customSystemPrompt!.trim()}`;
}
