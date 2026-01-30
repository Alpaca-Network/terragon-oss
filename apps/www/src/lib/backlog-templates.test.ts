import { describe, it, expect } from "vitest";
import {
  BUILT_IN_TEMPLATES,
  getAllTemplates,
  getTemplateById,
  createCustomTemplate,
  BacklogTemplate,
} from "./backlog-templates";

describe("Backlog Templates", () => {
  describe("BUILT_IN_TEMPLATES", () => {
    it("should have at least 5 built-in templates", () => {
      expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    });

    it("should have valid structure for all templates", () => {
      BUILT_IN_TEMPLATES.forEach((template) => {
        expect(template.id).toBeTruthy();
        expect(template.name).toBeTruthy();
        expect(template.description).toBeTruthy();
        expect(template.prompt).toBeTruthy();
        expect(template.isBuiltIn).toBe(true);
      });
    });

    it("should have unique IDs for all templates", () => {
      const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should include feature-prd template", () => {
      const featureTemplate = BUILT_IN_TEMPLATES.find(
        (t) => t.id === "feature-prd",
      );
      expect(featureTemplate).toBeDefined();
      expect(featureTemplate?.name).toBe("Feature PRD");
      expect(featureTemplate?.prompt).toContain("## Feature:");
    });

    it("should include bug-investigation template", () => {
      const bugTemplate = BUILT_IN_TEMPLATES.find(
        (t) => t.id === "bug-investigation",
      );
      expect(bugTemplate).toBeDefined();
      expect(bugTemplate?.name).toBe("Bug Investigation");
      expect(bugTemplate?.prompt).toContain("## Bug:");
    });

    it("should include code-review template", () => {
      const reviewTemplate = BUILT_IN_TEMPLATES.find(
        (t) => t.id === "code-review",
      );
      expect(reviewTemplate).toBeDefined();
      expect(reviewTemplate?.name).toBe("Code Review Request");
    });

    it("should include documentation-update template", () => {
      const docsTemplate = BUILT_IN_TEMPLATES.find(
        (t) => t.id === "documentation-update",
      );
      expect(docsTemplate).toBeDefined();
      expect(docsTemplate?.name).toBe("Documentation Update");
    });

    it("should include refactoring-task template", () => {
      const refactorTemplate = BUILT_IN_TEMPLATES.find(
        (t) => t.id === "refactoring-task",
      );
      expect(refactorTemplate).toBeDefined();
      expect(refactorTemplate?.name).toBe("Refactoring Task");
    });
  });

  describe("getAllTemplates", () => {
    it("should return built-in templates when no custom templates provided", () => {
      const templates = getAllTemplates();
      expect(templates).toEqual(BUILT_IN_TEMPLATES);
    });

    it("should return built-in templates when empty array provided", () => {
      const templates = getAllTemplates([]);
      expect(templates).toEqual(BUILT_IN_TEMPLATES);
    });

    it("should combine built-in and custom templates", () => {
      const customTemplate: BacklogTemplate = {
        id: "custom-1",
        name: "Custom Template",
        description: "A custom template",
        prompt: "Custom prompt",
        isBuiltIn: false,
      };
      const templates = getAllTemplates([customTemplate]);
      expect(templates.length).toBe(BUILT_IN_TEMPLATES.length + 1);
      expect(templates).toContain(customTemplate);
    });

    it("should place custom templates after built-in templates", () => {
      const customTemplate: BacklogTemplate = {
        id: "custom-1",
        name: "Custom Template",
        description: "A custom template",
        prompt: "Custom prompt",
        isBuiltIn: false,
      };
      const templates = getAllTemplates([customTemplate]);
      const lastTemplate = templates[templates.length - 1];
      expect(lastTemplate).toEqual(customTemplate);
    });
  });

  describe("getTemplateById", () => {
    it("should return template by ID from built-in templates", () => {
      const template = getTemplateById("feature-prd");
      expect(template).toBeDefined();
      expect(template?.id).toBe("feature-prd");
    });

    it("should return undefined for non-existent ID", () => {
      const template = getTemplateById("non-existent");
      expect(template).toBeUndefined();
    });

    it("should find custom template by ID", () => {
      const customTemplate: BacklogTemplate = {
        id: "custom-test",
        name: "Test Template",
        description: "Test",
        prompt: "Test prompt",
        isBuiltIn: false,
      };
      const template = getTemplateById("custom-test", [customTemplate]);
      expect(template).toEqual(customTemplate);
    });

    it("should return built-in template even when custom templates provided", () => {
      const customTemplate: BacklogTemplate = {
        id: "custom-test",
        name: "Test Template",
        description: "Test",
        prompt: "Test prompt",
        isBuiltIn: false,
      };
      const template = getTemplateById("bug-investigation", [customTemplate]);
      expect(template).toBeDefined();
      expect(template?.id).toBe("bug-investigation");
    });
  });

  describe("createCustomTemplate", () => {
    it("should create a custom template with correct structure", () => {
      const template = createCustomTemplate(
        "My Template",
        "My description",
        "My prompt content",
      );

      expect(template.name).toBe("My Template");
      expect(template.description).toBe("My description");
      expect(template.prompt).toBe("My prompt content");
      expect(template.isBuiltIn).toBe(false);
    });

    it("should generate unique ID starting with custom-", () => {
      const template = createCustomTemplate("Test", "Desc", "Prompt");
      expect(template.id).toMatch(/^custom-\d+$/);
    });

    it("should generate IDs with correct format for multiple templates", () => {
      const template1 = createCustomTemplate("Test 1", "Desc", "Prompt");
      const template2 = createCustomTemplate("Test 2", "Desc", "Prompt");
      // Verify the ID format is correct (custom-{timestamp})
      expect(template1.id).toMatch(/^custom-\d+$/);
      expect(template2.id).toMatch(/^custom-\d+$/);
    });
  });
});
