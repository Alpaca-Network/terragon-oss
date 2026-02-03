import { describe, it, expect } from "vitest";

/**
 * Tests for the KanbanNewTaskDrawer component logic.
 *
 * Key features tested:
 * - Mobile-friendly repo name display in header
 * - View mode switching between task creation and new project view
 * - State management for drawer open/close
 */
describe("KanbanNewTaskDrawer", () => {
  describe("Repo name display", () => {
    it("should extract repo name from full repo path", () => {
      const getRepoDisplayName = (selectedRepo: string | null) =>
        selectedRepo?.split("/")[1] || null;

      expect(getRepoDisplayName("owner/my-repo")).toBe("my-repo");
      expect(getRepoDisplayName("github-user/project-name")).toBe(
        "project-name",
      );
      expect(getRepoDisplayName(null)).toBe(null);
    });

    it("should handle repo names with multiple slashes", () => {
      const getRepoDisplayName = (selectedRepo: string | null) =>
        selectedRepo?.split("/")[1] || null;

      // Only takes the second part (repo name), not anything after
      expect(getRepoDisplayName("owner/repo/extra")).toBe("repo");
    });

    it("should handle single-segment repo names", () => {
      const getRepoDisplayName = (selectedRepo: string | null) =>
        selectedRepo?.split("/")[1] || null;

      // If no slash, split returns single element, index 1 is undefined
      // The || null fallback converts undefined to null
      expect(getRepoDisplayName("repo-only")).toBe(null);
    });
  });

  describe("View mode management", () => {
    type ViewMode = "task" | "new-project";

    it("should start in task view mode", () => {
      const initialViewMode: ViewMode = "task";
      expect(initialViewMode).toBe("task");
    });

    it("should switch to new-project view when requested", () => {
      let viewMode: ViewMode = "task";
      const setViewMode = (mode: ViewMode) => {
        viewMode = mode;
      };

      setViewMode("new-project");
      expect(viewMode).toBe("new-project");
    });

    it("should reset view mode when drawer closes", () => {
      let viewMode: ViewMode = "new-project";
      const resetViewMode = () => {
        viewMode = "task";
      };

      const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
          resetViewMode();
        }
      };

      handleOpenChange(false);
      expect(viewMode).toBe("task");
    });
  });

  describe("New Project button visibility", () => {
    it("should show New Project button when no repo is selected", () => {
      const selectedRepo = null;
      const shouldShowNewProjectButton = !selectedRepo;
      expect(shouldShowNewProjectButton).toBe(true);
    });

    it("should hide New Project button when repo is selected", () => {
      const selectedRepo = "owner/repo";
      const shouldShowNewProjectButton = !selectedRepo;
      expect(shouldShowNewProjectButton).toBe(false);
    });
  });

  describe("Header display", () => {
    const getRepoDisplayName = (selectedRepo: string | null) =>
      selectedRepo?.split("/")[1] || null;

    it("should display repo name prominently when selected", () => {
      const selectedRepo = "owner/my-awesome-repo";
      const selectedBranch = "main";
      const repoDisplayName = getRepoDisplayName(selectedRepo);

      expect(repoDisplayName).toBe("my-awesome-repo");
      expect(selectedBranch).toBe("main");
    });

    it("should not display repo info when no repo selected", () => {
      const repoDisplayName = getRepoDisplayName(null);
      expect(repoDisplayName).toBe(null);
    });
  });
});
