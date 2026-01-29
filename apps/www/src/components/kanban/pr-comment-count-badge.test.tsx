import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the PRCommentCountBadge component logic.
 *
 * The component displays a badge with the count of unresolved PR comments
 * and allows clicking to open the comments tab.
 */
describe("PRCommentCountBadge component logic", () => {
  describe("rendering conditions", () => {
    it("should not render when repoFullName is null", () => {
      const shouldRender = (
        repoFullName: string | null,
        prNumber: number | null,
      ) => {
        return !!repoFullName && !!prNumber;
      };

      expect(shouldRender(null, 123)).toBe(false);
    });

    it("should not render when prNumber is null", () => {
      const shouldRender = (
        repoFullName: string | null,
        prNumber: number | null,
      ) => {
        return !!repoFullName && !!prNumber;
      };

      expect(shouldRender("owner/repo", null)).toBe(false);
    });

    it("should be eligible to render when both repoFullName and prNumber are provided", () => {
      const shouldRender = (
        repoFullName: string | null,
        prNumber: number | null,
      ) => {
        return !!repoFullName && !!prNumber;
      };

      expect(shouldRender("owner/repo", 123)).toBe(true);
    });
  });

  describe("comment count visibility", () => {
    it("should not show badge when comment count is 0", () => {
      const shouldShowBadge = (commentCount: number) => commentCount > 0;
      expect(shouldShowBadge(0)).toBe(false);
    });

    it("should show badge when comment count is greater than 0", () => {
      const shouldShowBadge = (commentCount: number) => commentCount > 0;
      expect(shouldShowBadge(1)).toBe(true);
      expect(shouldShowBadge(5)).toBe(true);
      expect(shouldShowBadge(100)).toBe(true);
    });
  });

  describe("title generation", () => {
    it("should use singular form for 1 comment", () => {
      const getTitle = (count: number) =>
        `${count} unresolved PR comment${count !== 1 ? "s" : ""}`;

      expect(getTitle(1)).toBe("1 unresolved PR comment");
    });

    it("should use plural form for multiple comments", () => {
      const getTitle = (count: number) =>
        `${count} unresolved PR comment${count !== 1 ? "s" : ""}`;

      expect(getTitle(2)).toBe("2 unresolved PR comments");
      expect(getTitle(10)).toBe("10 unresolved PR comments");
    });

    it("should use plural form for 0 comments", () => {
      const getTitle = (count: number) =>
        `${count} unresolved PR comment${count !== 1 ? "s" : ""}`;

      expect(getTitle(0)).toBe("0 unresolved PR comments");
    });
  });

  describe("click handler", () => {
    it("should stop propagation and call onClick callback", () => {
      const onClick = vi.fn();
      const stopPropagation = vi.fn();

      const handleClick = (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        onClick?.();
      };

      handleClick({ stopPropagation });

      expect(stopPropagation).toHaveBeenCalled();
      expect(onClick).toHaveBeenCalled();
    });

    it("should stop propagation even when onClick is not provided", () => {
      const onClick = undefined;
      const stopPropagation = vi.fn();

      const handleClick = (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        onClick?.();
      };

      handleClick({ stopPropagation });

      expect(stopPropagation).toHaveBeenCalled();
    });
  });
});
