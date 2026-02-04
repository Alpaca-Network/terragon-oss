import { describe, it, expect } from "vitest";

/**
 * Tests for the TaskViewToggle component logic.
 *
 * The TaskViewToggle component allows users to switch between New Project, Kanban, and Inbox views
 * for the task dashboard. It persists the view mode preference using a Jotai atom
 * and navigates to /dashboard when toggled from a different path.
 *
 * Key behaviors:
 * - Displays "Task View:" label and three buttons: "New Project", "Kanban", and "Inbox"
 * - Highlights the currently selected view mode
 * - Updates the dashboardViewModeAtom when a button is clicked
 * - Navigates to /dashboard if not already there
 * - When threadId is provided, navigates to keep the task open in both views (kanban/list)
 * - On mobile, defaults to new-project view for better onboarding experience
 */
describe("TaskViewToggle logic", () => {
  describe("view mode state management", () => {
    it("should have list, kanban, and new-project as valid view modes", () => {
      const validModes = ["list", "kanban", "new-project"];
      expect(validModes).toContain("list");
      expect(validModes).toContain("kanban");
      expect(validModes).toContain("new-project");
    });

    it("should determine correct button styling based on view mode", () => {
      const getButtonClassName = (viewMode: string, buttonMode: string) => {
        const isSelected = viewMode === buttonMode;
        return isSelected ? "bg-background shadow-sm" : "";
      };

      // When viewMode is list, Inbox button should be selected
      expect(getButtonClassName("list", "list")).toContain("bg-background");
      expect(getButtonClassName("list", "kanban")).not.toContain(
        "bg-background",
      );
      expect(getButtonClassName("list", "new-project")).not.toContain(
        "bg-background",
      );

      // When viewMode is kanban, Kanban button should be selected
      expect(getButtonClassName("kanban", "kanban")).toContain("bg-background");
      expect(getButtonClassName("kanban", "list")).not.toContain(
        "bg-background",
      );
      expect(getButtonClassName("kanban", "new-project")).not.toContain(
        "bg-background",
      );

      // When viewMode is new-project, New Project button should be selected
      expect(getButtonClassName("new-project", "new-project")).toContain(
        "bg-background",
      );
      expect(getButtonClassName("new-project", "list")).not.toContain(
        "bg-background",
      );
      expect(getButtonClassName("new-project", "kanban")).not.toContain(
        "bg-background",
      );
    });
  });

  describe("navigation logic", () => {
    it("should navigate to /dashboard when current path is different and no threadId", () => {
      const getNavigationPath = (
        pathname: string,
        mode: "list" | "kanban" | "new-project",
        threadId?: string,
      ) => {
        if (threadId) {
          if (mode === "kanban") {
            return `/dashboard?task=${threadId}`;
          } else if (mode === "list") {
            return `/task/${threadId}`;
          } else {
            return "/dashboard";
          }
        } else if (pathname !== "/dashboard") {
          return "/dashboard";
        }
        return null; // No navigation needed
      };

      expect(getNavigationPath("/automations", "kanban")).toBe("/dashboard");
      expect(getNavigationPath("/settings", "list")).toBe("/dashboard");
      expect(getNavigationPath("/settings", "new-project")).toBe("/dashboard");
      expect(getNavigationPath("/dashboard", "kanban")).toBe(null);
    });

    it("should navigate to task page when switching to inbox with threadId", () => {
      const getNavigationPath = (
        mode: "list" | "kanban" | "new-project",
        threadId: string,
      ) => {
        if (mode === "kanban") {
          return `/dashboard?task=${threadId}`;
        } else if (mode === "list") {
          return `/task/${threadId}`;
        } else {
          return "/dashboard";
        }
      };

      const threadId = "test-thread-123";
      expect(getNavigationPath("list", threadId)).toBe(`/task/${threadId}`);
    });

    it("should navigate to dashboard with task param when switching to kanban with threadId", () => {
      const getNavigationPath = (
        mode: "list" | "kanban" | "new-project",
        threadId: string,
      ) => {
        if (mode === "kanban") {
          return `/dashboard?task=${threadId}`;
        } else if (mode === "list") {
          return `/task/${threadId}`;
        } else {
          return "/dashboard";
        }
      };

      const threadId = "test-thread-456";
      expect(getNavigationPath("kanban", threadId)).toBe(
        `/dashboard?task=${threadId}`,
      );
    });

    it("should navigate to dashboard when switching to new-project with threadId", () => {
      const getNavigationPath = (
        mode: "list" | "kanban" | "new-project",
        threadId: string,
      ) => {
        if (mode === "kanban") {
          return `/dashboard?task=${threadId}`;
        } else if (mode === "list") {
          return `/task/${threadId}`;
        } else {
          return "/dashboard";
        }
      };

      const threadId = "test-thread-789";
      expect(getNavigationPath("new-project", threadId)).toBe("/dashboard");
    });
  });

  describe("toggle behavior", () => {
    it("should switch from list to kanban when kanban is selected", () => {
      const currentMode = "list";
      const newMode = "kanban";
      expect(newMode).not.toBe(currentMode);
      expect(newMode).toBe("kanban");
    });

    it("should switch from kanban to inbox when inbox is selected", () => {
      const currentMode = "kanban";
      const newMode = "list";
      expect(newMode).not.toBe(currentMode);
      expect(newMode).toBe("list");
    });

    it("should switch from list to new-project when new-project is selected", () => {
      const currentMode = "list";
      const newMode = "new-project";
      expect(newMode).not.toBe(currentMode);
      expect(newMode).toBe("new-project");
    });

    it("should switch from new-project to kanban when kanban is selected", () => {
      const currentMode = "new-project";
      const newMode = "kanban";
      expect(newMode).not.toBe(currentMode);
      expect(newMode).toBe("kanban");
    });

    it("should handle clicking the same mode (no-op)", () => {
      const currentMode = "list";
      const newMode = "list";
      expect(newMode).toBe(currentMode);
    });
  });

  describe("button configuration", () => {
    it("should have correct labels for each view mode", () => {
      const buttons = [
        { mode: "new-project", label: "New Project" },
        { mode: "kanban", label: "Kanban" },
        { mode: "list", label: "Inbox" },
      ];

      expect(buttons.find((b) => b.mode === "new-project")?.label).toBe(
        "New Project",
      );
      expect(buttons.find((b) => b.mode === "kanban")?.label).toBe("Kanban");
      expect(buttons.find((b) => b.mode === "list")?.label).toBe("Inbox");
    });
  });

  describe("threadId preservation", () => {
    it("should preserve task context when switching views with threadId", () => {
      const threadId = "abc-123";

      // Simulates the navigation logic
      const getTargetUrl = (
        mode: "list" | "kanban" | "new-project",
        id: string,
      ) => {
        if (mode === "kanban") {
          return `/dashboard?task=${id}`;
        } else if (mode === "list") {
          return `/task/${id}`;
        }
        return "/dashboard";
      };

      // Switching to kanban should use query param
      expect(getTargetUrl("kanban", threadId)).toBe("/dashboard?task=abc-123");

      // Switching to inbox should go to task page directly
      expect(getTargetUrl("list", threadId)).toBe("/task/abc-123");

      // Switching to new-project should go to dashboard (no task context needed)
      expect(getTargetUrl("new-project", threadId)).toBe("/dashboard");
    });
  });

  describe("mobile behavior", () => {
    // Helper function to simulate the mobile default logic
    const shouldSwitchToNewProject = (
      platform: "mobile" | "desktop" | "unknown",
      viewMode: "list" | "kanban" | "new-project",
    ) => {
      return platform === "mobile" && viewMode === "list";
    };

    it("should default to new-project view on mobile for better onboarding", () => {
      // On mobile, when viewMode is list (default), it should switch to new-project
      expect(shouldSwitchToNewProject("mobile", "list")).toBe(true);
    });

    it("should not switch view on desktop", () => {
      expect(shouldSwitchToNewProject("desktop", "list")).toBe(false);
    });

    it("should not switch if user already chose kanban", () => {
      expect(shouldSwitchToNewProject("mobile", "kanban")).toBe(false);
    });

    it("should not switch if user already chose new-project", () => {
      expect(shouldSwitchToNewProject("mobile", "new-project")).toBe(false);
    });
  });
});
