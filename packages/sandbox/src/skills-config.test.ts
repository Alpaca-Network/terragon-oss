import { describe, it, expect } from "vitest";
import {
  validateSkillsConfig,
  createEmptySkillsConfig,
  addSkillToConfig,
  removeSkillFromConfig,
  updateSkillInConfig,
  type UserSkill,
} from "./skills-config";

describe("validateSkillsConfig", () => {
  describe("Valid configurations", () => {
    it("should validate a skill with all fields", () => {
      const config = {
        skills: {
          "explain-code": {
            name: "explain-code",
            displayName: "Explain Code",
            description: "Explains code with visual diagrams and analogies",
            argumentHint: "[filename]",
            content: "Analyze the code at $ARGUMENTS and explain it clearly.",
            disableModelInvocation: false,
            userInvocable: true,
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it("should validate a skill with only required fields", () => {
      const config = {
        skills: {
          "minimal-skill": {
            name: "minimal-skill",
            description: "A minimal skill",
            content: "Do something useful.",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skills["minimal-skill"]).toBeDefined();
      }
    });

    it("should validate empty skills object", () => {
      const config = {
        skills: {},
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it("should validate multiple skills", () => {
      const config = {
        skills: {
          "skill-one": {
            name: "skill-one",
            description: "First skill",
            content: "Content one",
          },
          "skill-two": {
            name: "skill-two",
            description: "Second skill",
            content: "Content two",
            disableModelInvocation: true,
          },
          "skill-three": {
            name: "skill-three",
            description: "Third skill",
            content: "Content three",
            userInvocable: false,
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(true);
    });

    it("should validate skill names with dashes and underscores", () => {
      const config = {
        skills: {
          "skill-with-dashes": {
            name: "skill-with-dashes",
            description: "Test",
            content: "Test",
          },
          skill_with_underscores: {
            name: "skill_with_underscores",
            description: "Test",
            content: "Test",
          },
          CamelCaseSkill: {
            name: "CamelCaseSkill",
            description: "Test",
            content: "Test",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(true);
    });
  });

  describe("Invalid configurations", () => {
    it("should reject skill with reserved name 'init'", () => {
      const config = {
        skills: {
          init: {
            name: "init",
            description: "Init skill",
            content: "Initialize",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Cannot use 'init' as a skill name");
        expect(result.error).toContain("reserved");
      }
    });

    it("should reject skill with reserved name 'help'", () => {
      const config = {
        skills: {
          help: {
            name: "help",
            description: "Help skill",
            content: "Help content",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Cannot use 'help' as a skill name");
      }
    });

    it("should reject skill with reserved name 'pr-comments'", () => {
      const config = {
        skills: {
          "pr-comments": {
            name: "pr-comments",
            description: "PR comments skill",
            content: "Content",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain(
          "Cannot use 'pr-comments' as a skill name",
        );
      }
    });

    it("should reject skill without name field", () => {
      const config = {
        skills: {
          "bad-skill": {
            description: "Missing name",
            content: "Content",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("name");
      }
    });

    it("should reject skill with empty name", () => {
      const config = {
        skills: {
          "empty-name": {
            name: "",
            description: "Empty name",
            content: "Content",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Name is required");
      }
    });

    it("should reject skill with invalid name characters", () => {
      const config = {
        skills: {
          "bad.skill": {
            name: "bad.skill",
            description: "Has dots",
            content: "Content",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain(
          "must contain only letters, numbers, dashes, and underscores",
        );
      }
    });

    it("should reject skill with spaces in name", () => {
      const config = {
        skills: {
          "bad skill": {
            name: "bad skill",
            description: "Has spaces",
            content: "Content",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
    });

    it("should reject skill without description", () => {
      const config = {
        skills: {
          "no-desc": {
            name: "no-desc",
            content: "Content",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("description");
      }
    });

    it("should reject skill with empty description", () => {
      const config = {
        skills: {
          "empty-desc": {
            name: "empty-desc",
            description: "",
            content: "Content",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Description is required");
      }
    });

    it("should reject skill without content", () => {
      const config = {
        skills: {
          "no-content": {
            name: "no-content",
            description: "No content",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("content");
      }
    });

    it("should reject skill with empty content", () => {
      const config = {
        skills: {
          "empty-content": {
            name: "empty-content",
            description: "Empty content",
            content: "",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Skill content is required");
      }
    });

    it("should reject when skill key does not match skill name", () => {
      const config = {
        skills: {
          "skill-key": {
            name: "different-name",
            description: "Mismatched key and name",
            content: "Content",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain(
          "Skill key 'skill-key' does not match skill name 'different-name'",
        );
      }
    });

    it("should reject config without skills field", () => {
      const config = {};

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("skills");
      }
    });

    it("should reject config with skills as non-object", () => {
      const config = {
        skills: "not-an-object",
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
    });

    it("should reject null config", () => {
      const result = validateSkillsConfig(null);
      expect(result.success).toBe(false);
    });

    it("should reject undefined config", () => {
      const result = validateSkillsConfig(undefined);
      expect(result.success).toBe(false);
    });
  });

  describe("Error messages", () => {
    it("should provide specific error path for nested errors", () => {
      const config = {
        skills: {
          "test-skill": {
            name: "test-skill",
            description: "Test",
            content: "Test",
            disableModelInvocation: "not-a-boolean",
          },
        },
      };

      const result = validateSkillsConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain(
          "skills.test-skill.disableModelInvocation",
        );
      }
    });
  });
});

describe("Helper functions", () => {
  describe("createEmptySkillsConfig", () => {
    it("should create an empty skills config", () => {
      const config = createEmptySkillsConfig();
      expect(config).toEqual({ skills: {} });
    });
  });

  describe("addSkillToConfig", () => {
    it("should add a skill to an empty config", () => {
      const config = createEmptySkillsConfig();
      const skill: UserSkill = {
        name: "test-skill",
        description: "Test skill",
        content: "Test content",
        disableModelInvocation: false,
        userInvocable: true,
      };

      const result = addSkillToConfig(config, skill);
      expect(result.skills["test-skill"]).toEqual(skill);
    });

    it("should add a skill to an existing config", () => {
      const config = {
        skills: {
          "existing-skill": {
            name: "existing-skill",
            description: "Existing",
            content: "Existing content",
            disableModelInvocation: false,
            userInvocable: true,
          },
        },
      };

      const skill: UserSkill = {
        name: "new-skill",
        description: "New skill",
        content: "New content",
        disableModelInvocation: false,
        userInvocable: true,
      };

      const result = addSkillToConfig(config, skill);
      expect(Object.keys(result.skills)).toHaveLength(2);
      expect(result.skills["existing-skill"]).toBeDefined();
      expect(result.skills["new-skill"]).toBeDefined();
    });

    it("should override an existing skill with the same name", () => {
      const config = {
        skills: {
          "test-skill": {
            name: "test-skill",
            description: "Old description",
            content: "Old content",
            disableModelInvocation: false,
            userInvocable: true,
          },
        },
      };

      const skill: UserSkill = {
        name: "test-skill",
        description: "New description",
        content: "New content",
        disableModelInvocation: true,
        userInvocable: false,
      };

      const result = addSkillToConfig(config, skill);
      expect(result.skills["test-skill"]?.description).toBe("New description");
      expect(result.skills["test-skill"]?.disableModelInvocation).toBe(true);
    });
  });

  describe("removeSkillFromConfig", () => {
    it("should remove a skill from config", () => {
      const config = {
        skills: {
          "skill-to-remove": {
            name: "skill-to-remove",
            description: "Remove me",
            content: "Content",
            disableModelInvocation: false,
            userInvocable: true,
          },
          "skill-to-keep": {
            name: "skill-to-keep",
            description: "Keep me",
            content: "Content",
            disableModelInvocation: false,
            userInvocable: true,
          },
        },
      };

      const result = removeSkillFromConfig(config, "skill-to-remove");
      expect(result.skills["skill-to-remove"]).toBeUndefined();
      expect(result.skills["skill-to-keep"]).toBeDefined();
    });

    it("should handle removing a non-existent skill", () => {
      const config = {
        skills: {
          "existing-skill": {
            name: "existing-skill",
            description: "Existing",
            content: "Content",
            disableModelInvocation: false,
            userInvocable: true,
          },
        },
      };

      const result = removeSkillFromConfig(config, "non-existent");
      expect(result.skills["existing-skill"]).toBeDefined();
      expect(Object.keys(result.skills)).toHaveLength(1);
    });
  });

  describe("updateSkillInConfig", () => {
    it("should update a skill in place when name stays the same", () => {
      const config = {
        skills: {
          "test-skill": {
            name: "test-skill",
            description: "Old description",
            content: "Old content",
            disableModelInvocation: false,
            userInvocable: true,
          },
        },
      };

      const updatedSkill: UserSkill = {
        name: "test-skill",
        description: "New description",
        content: "New content",
        disableModelInvocation: true,
        userInvocable: true,
      };

      const result = updateSkillInConfig(config, "test-skill", updatedSkill);
      expect(result.skills["test-skill"]?.description).toBe("New description");
      expect(Object.keys(result.skills)).toHaveLength(1);
    });

    it("should handle renaming a skill", () => {
      const config = {
        skills: {
          "old-name": {
            name: "old-name",
            description: "Description",
            content: "Content",
            disableModelInvocation: false,
            userInvocable: true,
          },
        },
      };

      const renamedSkill: UserSkill = {
        name: "new-name",
        description: "Description",
        content: "Content",
        disableModelInvocation: false,
        userInvocable: true,
      };

      const result = updateSkillInConfig(config, "old-name", renamedSkill);
      expect(result.skills["old-name"]).toBeUndefined();
      expect(result.skills["new-name"]).toBeDefined();
      expect(Object.keys(result.skills)).toHaveLength(1);
    });

    it("should preserve other skills when renaming", () => {
      const config = {
        skills: {
          "skill-to-rename": {
            name: "skill-to-rename",
            description: "Description",
            content: "Content",
            disableModelInvocation: false,
            userInvocable: true,
          },
          "other-skill": {
            name: "other-skill",
            description: "Other",
            content: "Other content",
            disableModelInvocation: false,
            userInvocable: true,
          },
        },
      };

      const renamedSkill: UserSkill = {
        name: "renamed-skill",
        description: "Description",
        content: "Content",
        disableModelInvocation: false,
        userInvocable: true,
      };

      const result = updateSkillInConfig(
        config,
        "skill-to-rename",
        renamedSkill,
      );
      expect(result.skills["skill-to-rename"]).toBeUndefined();
      expect(result.skills["renamed-skill"]).toBeDefined();
      expect(result.skills["other-skill"]).toBeDefined();
      expect(Object.keys(result.skills)).toHaveLength(2);
    });
  });
});
