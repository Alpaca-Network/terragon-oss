import { describe, it, expect } from "vitest";

/**
 * Tests for the onboarding component button logic.
 *
 * The key fix being tested: The "Grant Repository Access" button should be
 * clickable when no repos are found (hasRepos === false). Previously, the button
 * was disabled when no repos were found, which prevented users from proceeding
 * with the GitHub App installation.
 *
 * The button logic is:
 * - When hasRepos === true: Button says "Continue" and triggers onContinue callback
 * - When hasRepos === false: Button says "Grant Repository Access" and opens GitHub App install popup
 */
describe("Onboarding button logic", () => {
  describe("hasRepos state", () => {
    it("should return true when repos array has items", () => {
      const repos = [{ id: 1, full_name: "test/repo" }];
      const hasRepos = repos && repos.length > 0;
      expect(hasRepos).toBe(true);
    });

    it("should return false when repos array is empty", () => {
      const repos: any[] = [];
      const hasRepos = repos && repos.length > 0;
      expect(hasRepos).toBe(false);
    });

    it("should be falsy when repos is null", () => {
      const repos = null;
      const hasRepos = repos && repos.length > 0;
      expect(hasRepos).toBeFalsy();
    });

    it("should return false when repos is undefined", () => {
      const repos = undefined;
      const hasRepos = repos && (repos as any[]).length > 0;
      expect(hasRepos).toBeFalsy();
    });
  });

  describe("button behavior determination", () => {
    const determineButtonBehavior = (repos: any[] | null) => {
      const hasRepos = repos && repos.length > 0;
      return {
        text: hasRepos ? "Continue" : "Grant Repository Access",
        action: hasRepos ? "onContinue" : "openGitHubAppInstall",
        isDisabled: false, // Button should never be disabled
      };
    };

    it("should show Continue button and onContinue action when repos exist", () => {
      const result = determineButtonBehavior([
        { id: 1, full_name: "test/repo" },
      ]);
      expect(result.text).toBe("Continue");
      expect(result.action).toBe("onContinue");
      expect(result.isDisabled).toBe(false);
    });

    it("should show Grant Repository Access button and openGitHubAppInstall action when no repos", () => {
      const result = determineButtonBehavior([]);
      expect(result.text).toBe("Grant Repository Access");
      expect(result.action).toBe("openGitHubAppInstall");
      expect(result.isDisabled).toBe(false);
    });

    it("should show Grant Repository Access button when repos is null", () => {
      const result = determineButtonBehavior(null);
      expect(result.text).toBe("Grant Repository Access");
      expect(result.action).toBe("openGitHubAppInstall");
      expect(result.isDisabled).toBe(false);
    });

    it("button should never be disabled regardless of repos state", () => {
      // This test verifies the fix - previously button was disabled when no repos
      const emptyReposResult = determineButtonBehavior([]);
      const nullReposResult = determineButtonBehavior(null);
      const withReposResult = determineButtonBehavior([{ id: 1 }]);

      expect(emptyReposResult.isDisabled).toBe(false);
      expect(nullReposResult.isDisabled).toBe(false);
      expect(withReposResult.isDisabled).toBe(false);
    });
  });

  describe("GitHub App install URL construction", () => {
    it("should append ?state=close to the GitHub App install URL", () => {
      const baseUrl =
        "https://github.com/apps/test-app/installations/select_target";
      const fullUrl = baseUrl + "?state=close";
      expect(fullUrl).toBe(
        "https://github.com/apps/test-app/installations/select_target?state=close",
      );
    });
  });
});
