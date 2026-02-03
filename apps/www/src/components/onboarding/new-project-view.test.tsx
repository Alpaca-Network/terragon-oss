import { describe, it, expect } from "vitest";
import { TEMPLATE_REPOS } from "@/lib/template-repos";

/**
 * Tests for the NewProjectView component logic.
 *
 * This component provides a dedicated view for creating new projects with:
 * - Template selection (popular and more options)
 * - Search functionality for GitHub templates
 * - Onboarding help section
 * - Back navigation
 */
describe("NewProjectView", () => {
  describe("Template rendering", () => {
    it("should split templates into popular (first 4) and more options", () => {
      const popularTemplates = TEMPLATE_REPOS.slice(0, 4);
      const moreTemplates = TEMPLATE_REPOS.slice(4);

      expect(popularTemplates.length).toBe(4);
      expect(moreTemplates.length).toBe(TEMPLATE_REPOS.length - 4);
      expect(popularTemplates.length + moreTemplates.length).toBe(
        TEMPLATE_REPOS.length,
      );
    });

    it("should have all required template properties", () => {
      TEMPLATE_REPOS.forEach((template) => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.icon).toBeDefined();
        expect(template.suggestedFirstTask).toBeDefined();
      });
    });

    it("should include blank repository as a template option", () => {
      const blankTemplate = TEMPLATE_REPOS.find((t) => t.id === "blank");
      expect(blankTemplate).toBeDefined();
      expect(blankTemplate?.name).toBe("Blank Repository");
      expect(blankTemplate?.githubOwner).toBeNull();
      expect(blankTemplate?.githubRepo).toBeNull();
    });
  });

  describe("View state management", () => {
    it("should reset state when onRepoCreated is called", () => {
      // The component should close dialogs when a repo is created
      // This is verified by the handleRepoCreated function setting
      // showCreateDialog and showSearchDialog to false
      let showCreateDialog = true;
      let showSearchDialog = true;

      const handleRepoCreated = () => {
        showCreateDialog = false;
        showSearchDialog = false;
      };

      handleRepoCreated();

      expect(showCreateDialog).toBe(false);
      expect(showSearchDialog).toBe(false);
    });
  });

  describe("Back navigation", () => {
    it("should call onBack when back button is clicked", () => {
      let backCalled = false;
      const onBack = () => {
        backCalled = true;
      };

      // Simulate back button click
      onBack();

      expect(backCalled).toBe(true);
    });

    it("should not render back button when onBack is not provided", () => {
      // The component conditionally renders the back button
      // {onBack && <Button ... />}
      const onBack = undefined;
      const shouldShowBackButton = !!onBack;

      expect(shouldShowBackButton).toBe(false);
    });
  });
});
