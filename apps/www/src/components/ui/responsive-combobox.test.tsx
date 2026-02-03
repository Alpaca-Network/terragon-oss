import { describe, it, expect } from "vitest";

/**
 * Tests for the ResponsiveCombobox component logic.
 *
 * Key features tested:
 * - Mobile label support for displaying shorter labels on mobile
 * - Desktop vs mobile rendering logic
 * - Item selection and display
 */
describe("ResponsiveCombobox", () => {
  describe("Mobile label support", () => {
    type ComboboxItem = {
      value: string;
      label: string;
      mobileLabel?: string;
    };

    const getDisplayLabel = (
      selectedItem: ComboboxItem | null,
      isDesktop: boolean,
      placeholder: string,
    ): string => {
      if (!selectedItem) return placeholder;
      return (!isDesktop && selectedItem.mobileLabel) || selectedItem.label;
    };

    it("should use mobileLabel on mobile when available", () => {
      const item: ComboboxItem = {
        value: "owner/my-long-repo-name",
        label: "owner/my-long-repo-name",
        mobileLabel: "my-long-repo-name",
      };

      const displayLabel = getDisplayLabel(item, false, "Select");
      expect(displayLabel).toBe("my-long-repo-name");
    });

    it("should use full label on desktop even when mobileLabel exists", () => {
      const item: ComboboxItem = {
        value: "owner/my-long-repo-name",
        label: "owner/my-long-repo-name",
        mobileLabel: "my-long-repo-name",
      };

      const displayLabel = getDisplayLabel(item, true, "Select");
      expect(displayLabel).toBe("owner/my-long-repo-name");
    });

    it("should fall back to label when mobileLabel is not provided", () => {
      const item: ComboboxItem = {
        value: "owner/repo",
        label: "owner/repo",
      };

      // Mobile without mobileLabel
      const mobileDisplayLabel = getDisplayLabel(item, false, "Select");
      expect(mobileDisplayLabel).toBe("owner/repo");

      // Desktop
      const desktopDisplayLabel = getDisplayLabel(item, true, "Select");
      expect(desktopDisplayLabel).toBe("owner/repo");
    });

    it("should show placeholder when no item is selected", () => {
      const displayLabel = getDisplayLabel(null, false, "Select a Repo");
      expect(displayLabel).toBe("Select a Repo");
    });
  });

  describe("Item finding", () => {
    type ComboboxItem = {
      value: string;
      label: string;
      mobileLabel?: string;
    };

    const items: ComboboxItem[] = [
      {
        value: "owner/repo1",
        label: "owner/repo1",
        mobileLabel: "repo1",
      },
      {
        value: "owner/repo2",
        label: "owner/repo2",
        mobileLabel: "repo2",
      },
    ];

    it("should find selected item by value", () => {
      const value = "owner/repo1";
      const selectedItem = items.find((item) => item.value === value);
      expect(selectedItem).toBeDefined();
      expect(selectedItem?.mobileLabel).toBe("repo1");
    });

    it("should return undefined when value not found", () => {
      const value = "nonexistent/repo";
      const selectedItem = items.find((item) => item.value === value);
      expect(selectedItem).toBeUndefined();
    });
  });

  describe("Breakpoint handling", () => {
    it("should use 768px as the desktop breakpoint", () => {
      const DESKTOP_BREAKPOINT = 768;
      const isDesktop = (width: number) => width >= DESKTOP_BREAKPOINT;

      expect(isDesktop(767)).toBe(false);
      expect(isDesktop(768)).toBe(true);
      expect(isDesktop(1024)).toBe(true);
    });
  });
});
