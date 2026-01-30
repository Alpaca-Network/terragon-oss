import { describe, it, expect } from "vitest";

describe("Collapsible Thread List Logic", () => {
  describe("canCollapseThreadList calculation", () => {
    // Helper that mirrors the logic from the hook
    const canCollapseThreadList = (
      isMobile: boolean,
      pathname: string,
      viewMode: "list" | "kanban",
    ): boolean => {
      const isDashboardKanban =
        pathname === "/dashboard" && viewMode === "kanban";
      return !isMobile && (pathname !== "/dashboard" || isDashboardKanban);
    };

    it("should allow collapse on thread page (not dashboard)", () => {
      const result = canCollapseThreadList(false, "/task/123", "list");
      expect(result).toBe(true);
    });

    it("should not allow collapse on mobile", () => {
      const result = canCollapseThreadList(true, "/task/123", "list");
      expect(result).toBe(false);
    });

    it("should not allow collapse on dashboard with list view", () => {
      const result = canCollapseThreadList(false, "/dashboard", "list");
      expect(result).toBe(false);
    });

    it("should allow collapse on dashboard with kanban view", () => {
      const result = canCollapseThreadList(false, "/dashboard", "kanban");
      expect(result).toBe(true);
    });

    it("should not allow collapse on mobile even with kanban view", () => {
      const result = canCollapseThreadList(true, "/dashboard", "kanban");
      expect(result).toBe(false);
    });

    it("should allow collapse on any other path", () => {
      expect(canCollapseThreadList(false, "/settings", "list")).toBe(true);
      expect(canCollapseThreadList(false, "/", "list")).toBe(true);
      expect(canCollapseThreadList(false, "/task/abc-123", "kanban")).toBe(
        true,
      );
    });
  });

  describe("isThreadListCollapsed calculation", () => {
    // Helper that mirrors the logic from the hook
    const isThreadListCollapsed = (
      canCollapse: boolean,
      cookieCollapsed: boolean,
    ): boolean => {
      return canCollapse && cookieCollapsed;
    };

    it("should be collapsed when both conditions are true", () => {
      const result = isThreadListCollapsed(true, true);
      expect(result).toBe(true);
    });

    it("should not be collapsed if cannot collapse", () => {
      const result = isThreadListCollapsed(false, true);
      expect(result).toBe(false);
    });

    it("should not be collapsed if cookie is false", () => {
      const result = isThreadListCollapsed(true, false);
      expect(result).toBe(false);
    });

    it("should not be collapsed when both are false", () => {
      const result = isThreadListCollapsed(false, false);
      expect(result).toBe(false);
    });
  });

  describe("isDashboardKanban calculation", () => {
    // Helper that mirrors the logic from the hook
    const isDashboardKanban = (
      pathname: string,
      viewMode: "list" | "kanban",
    ): boolean => {
      return pathname === "/dashboard" && viewMode === "kanban";
    };

    it("should be true on dashboard with kanban view", () => {
      expect(isDashboardKanban("/dashboard", "kanban")).toBe(true);
    });

    it("should be false on dashboard with list view", () => {
      expect(isDashboardKanban("/dashboard", "list")).toBe(false);
    });

    it("should be false on non-dashboard pages", () => {
      expect(isDashboardKanban("/task/123", "kanban")).toBe(false);
      expect(isDashboardKanban("/settings", "kanban")).toBe(false);
    });

    it("should handle paths that contain dashboard but are not exact match", () => {
      // usePathname() only returns the pathname without query params
      expect(isDashboardKanban("/dashboard/settings", "kanban")).toBe(false);
      expect(isDashboardKanban("/dashboards", "kanban")).toBe(false);
    });
  });

  describe("Auto-collapse behavior in kanban mode", () => {
    // This tests the expected behavior of auto-collapsing sidebar when entering kanban view

    it("should trigger auto-collapse when entering dashboard kanban view", () => {
      // Simulating: isDashboardKanban=true, isThreadListCollapsed=false
      // Expected: setThreadListCollapsed(true) should be called
      const isDashboardKanban = true;
      const isThreadListCollapsed = false;
      const shouldAutoCollapse = isDashboardKanban && !isThreadListCollapsed;
      expect(shouldAutoCollapse).toBe(true);
    });

    it("should not trigger auto-collapse if already collapsed", () => {
      const isDashboardKanban = true;
      const isThreadListCollapsed = true;
      const shouldAutoCollapse = isDashboardKanban && !isThreadListCollapsed;
      expect(shouldAutoCollapse).toBe(false);
    });

    it("should not trigger auto-collapse if not in kanban mode", () => {
      const isDashboardKanban = false;
      const isThreadListCollapsed = false;
      const shouldAutoCollapse = isDashboardKanban && !isThreadListCollapsed;
      expect(shouldAutoCollapse).toBe(false);
    });
  });
});
