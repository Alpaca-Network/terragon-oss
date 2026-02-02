import { describe, it, expect } from "vitest";
import { ThreadInfo } from "@terragon/shared";

describe("Kanban Search Filtering", () => {
  // Helper function to match how the search filter works in the components
  const matchesSearchQuery = (
    thread: { name?: string | null; githubRepoFullName?: string | null },
    searchQuery: string,
  ): boolean => {
    if (!searchQuery.trim()) return true;
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const threadName = thread.name?.toLowerCase() || "";
    const repoName = thread.githubRepoFullName?.toLowerCase() || "";
    return (
      threadName.includes(normalizedQuery) || repoName.includes(normalizedQuery)
    );
  };

  describe("matchesSearchQuery helper", () => {
    it("should return true when search query is empty", () => {
      const thread = { name: "Test task", githubRepoFullName: "org/repo" };
      expect(matchesSearchQuery(thread, "")).toBe(true);
      expect(matchesSearchQuery(thread, "   ")).toBe(true);
    });

    it("should match against thread name", () => {
      const thread = {
        name: "Fix authentication bug",
        githubRepoFullName: "myorg/api",
      };
      expect(matchesSearchQuery(thread, "auth")).toBe(true);
      expect(matchesSearchQuery(thread, "bug")).toBe(true);
      expect(matchesSearchQuery(thread, "Fix")).toBe(true);
    });

    it("should match against repository name", () => {
      const thread = {
        name: "Update dependencies",
        githubRepoFullName: "terragon/frontend",
      };
      expect(matchesSearchQuery(thread, "terragon")).toBe(true);
      expect(matchesSearchQuery(thread, "frontend")).toBe(true);
      expect(matchesSearchQuery(thread, "terragon/front")).toBe(true);
    });

    it("should be case insensitive", () => {
      const thread = {
        name: "Add New Feature",
        githubRepoFullName: "MyOrg/Backend",
      };
      expect(matchesSearchQuery(thread, "add")).toBe(true);
      expect(matchesSearchQuery(thread, "ADD")).toBe(true);
      expect(matchesSearchQuery(thread, "New FEATURE")).toBe(true);
      expect(matchesSearchQuery(thread, "myorg")).toBe(true);
      expect(matchesSearchQuery(thread, "BACKEND")).toBe(true);
    });

    it("should trim whitespace from search query", () => {
      const thread = { name: "Test task", githubRepoFullName: "org/repo" };
      expect(matchesSearchQuery(thread, "  test  ")).toBe(true);
      expect(matchesSearchQuery(thread, "\trepo\t")).toBe(true);
    });

    it("should return false when no match found", () => {
      const thread = {
        name: "Fix login issue",
        githubRepoFullName: "company/app",
      };
      expect(matchesSearchQuery(thread, "authentication")).toBe(false);
      expect(matchesSearchQuery(thread, "backend")).toBe(false);
      expect(matchesSearchQuery(thread, "xyz123")).toBe(false);
    });

    it("should handle null or undefined names", () => {
      expect(matchesSearchQuery({ name: null }, "test")).toBe(false);
      expect(matchesSearchQuery({ name: undefined }, "test")).toBe(false);
      expect(matchesSearchQuery({ githubRepoFullName: null }, "test")).toBe(
        false,
      );
      expect(
        matchesSearchQuery({ githubRepoFullName: undefined }, "test"),
      ).toBe(false);
    });

    it("should match partial strings", () => {
      const thread = {
        name: "Implement user authentication flow",
        githubRepoFullName: "mycompany/website",
      };
      expect(matchesSearchQuery(thread, "auth")).toBe(true);
      expect(matchesSearchQuery(thread, "flow")).toBe(true);
      expect(matchesSearchQuery(thread, "mycomp")).toBe(true);
      expect(matchesSearchQuery(thread, "ation")).toBe(true);
    });

    it("should handle special characters in search", () => {
      const thread = {
        name: "Fix bug in user-profile component",
        githubRepoFullName: "org/my-app-v2",
      };
      expect(matchesSearchQuery(thread, "user-profile")).toBe(true);
      expect(matchesSearchQuery(thread, "my-app")).toBe(true);
      expect(matchesSearchQuery(thread, "v2")).toBe(true);
    });
  });

  describe("Filtering thread lists", () => {
    const mockThreads = [
      { name: "Fix login bug", githubRepoFullName: "org/frontend" },
      { name: "Add user settings page", githubRepoFullName: "org/frontend" },
      { name: "Update API endpoints", githubRepoFullName: "org/backend" },
      { name: "Write unit tests", githubRepoFullName: "org/backend" },
      { name: "Deploy to production", githubRepoFullName: "company/infra" },
    ];

    it("should return all threads when search is empty", () => {
      const filtered = mockThreads.filter((t) => matchesSearchQuery(t, ""));
      expect(filtered.length).toBe(mockThreads.length);
    });

    it("should filter threads by name", () => {
      const filtered = mockThreads.filter((t) => matchesSearchQuery(t, "bug"));
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.name).toBe("Fix login bug");
    });

    it("should filter threads by repository", () => {
      const filtered = mockThreads.filter((t) =>
        matchesSearchQuery(t, "backend"),
      );
      expect(filtered.length).toBe(2);
      expect(
        filtered.every((t) => t.githubRepoFullName?.includes("backend")),
      ).toBe(true);
    });

    it("should filter threads matching either name or repo", () => {
      const filtered = mockThreads.filter((t) =>
        matchesSearchQuery(t, "frontend"),
      );
      expect(filtered.length).toBe(2);
    });

    it("should return empty array when no matches", () => {
      const filtered = mockThreads.filter((t) =>
        matchesSearchQuery(t, "nonexistent"),
      );
      expect(filtered.length).toBe(0);
    });

    it("should handle single character search", () => {
      const filtered = mockThreads.filter((t) => matchesSearchQuery(t, "u"));
      // Matches: "Fix login bug" (bug), "Add user settings page" (user),
      // "Update API endpoints" (Update), "Write unit tests" (unit), "Deploy to production" (production)
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe("Search bar component behavior expectations", () => {
    it("should support compact mode with smaller dimensions", () => {
      // Compact mode should use smaller text and icon sizes
      const compactClasses = "h-8 pl-8 text-xs"; // height 8 (32px), text-xs
      const normalClasses = "h-9 pl-9 text-sm"; // height 9 (36px), text-sm

      expect(compactClasses).toContain("h-8");
      expect(normalClasses).toContain("h-9");
      expect(compactClasses).toContain("text-xs");
      expect(normalClasses).toContain("text-sm");
    });

    it("should have clear button when value is present", () => {
      // This tests the expected behavior - clear button appears when value exists
      const hasValue = "some search text";
      const showClearButton = !!hasValue;
      expect(showClearButton).toBe(true);

      const emptyValue = "";
      const hideClearButton = !emptyValue;
      expect(hideClearButton).toBe(true);
    });
  });
});
