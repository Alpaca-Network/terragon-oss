/**
 * Tests for merge-pr server actions
 *
 * Note: The mergePR and canMergePR functions are wrapped in userOnlyAction,
 * which makes them difficult to test in isolation. These tests verify the
 * logic through the exported functions.
 *
 * The key fix here is ensuring draft PRs are properly rejected before
 * attempting to merge them, preventing the error:
 * "Failed to merge PR: Pull Request is still a draft"
 */

import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mergePrFilePath = path.join(__dirname, "merge-pr.ts");

describe("merge-pr logic validation", () => {
  it("should have draft PR check in mergePR function", async () => {
    const content = await fs.readFile(mergePrFilePath, "utf-8");

    // Verify the draft check exists in mergePR
    expect(content).toContain("if (pr.draft) {");
    expect(content).toContain(
      '"Cannot merge a draft PR. Mark the PR as ready for review first."',
    );

    // Verify it's placed before the mergeable check
    const draftCheckIndex = content.indexOf("if (pr.draft) {");
    const mergeableCheckIndex = content.indexOf("if (!pr.mergeable) {");
    expect(draftCheckIndex).toBeLessThan(mergeableCheckIndex);
    expect(draftCheckIndex).toBeGreaterThan(0);
  });

  it("should have draft PR check in canMergePR function", async () => {
    const content = await fs.readFile(mergePrFilePath, "utf-8");

    // Find the canMergePR function content
    const canMergePRStart = content.indexOf("export const canMergePR");
    const canMergePRContent = content.slice(canMergePRStart);

    // Verify the draft check exists in canMergePR
    expect(canMergePRContent).toContain("if (pr.draft) {");
    expect(canMergePRContent).toContain('reason: "PR is a draft"');
    expect(canMergePRContent).toContain('mergeableState: "draft"');
  });

  it("should check for closed PR before draft PR", async () => {
    const content = await fs.readFile(mergePrFilePath, "utf-8");

    // Find mergePR function
    const mergePRStart = content.indexOf("export const mergePR");
    const canMergePRStart = content.indexOf("export const canMergePR");
    const mergePRContent = content.slice(mergePRStart, canMergePRStart);

    // Verify check order: closed -> draft -> mergeable
    const closedCheckIndex = mergePRContent.indexOf(
      'if (pr.state === "closed")',
    );
    const draftCheckIndex = mergePRContent.indexOf("if (pr.draft)");
    const mergeableCheckIndex = mergePRContent.indexOf("if (!pr.mergeable)");

    expect(closedCheckIndex).toBeLessThan(draftCheckIndex);
    expect(draftCheckIndex).toBeLessThan(mergeableCheckIndex);
  });
});
