import * as z from "zod/v4";

// Individual skill schema - stores user-configured skills
export const UserSkillSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Name must contain only letters, numbers, dashes, and underscores",
    ),
  displayName: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  argumentHint: z.string().optional(),
  content: z.string().min(1, "Skill content is required"),
  disableModelInvocation: z.boolean().default(false),
  userInvocable: z.boolean().default(true),
});

// Skills config schema (collection of skills keyed by skill name)
export const SkillsConfigSchema = z.object({
  skills: z.record(z.string(), UserSkillSchema),
});

export type UserSkill = z.infer<typeof UserSkillSchema>;
export type SkillsConfig = z.infer<typeof SkillsConfigSchema>;

// Reserved skill names that cannot be used
export const RESERVED_SKILL_NAMES = [
  "init",
  "pr-comments",
  "review",
  "clear",
  "compact",
  "help",
  "bug",
  "config",
  "cost",
  "doctor",
  "login",
  "logout",
  "mcp",
  "memory",
  "model",
  "permissions",
  "resume",
  "terminal-setup",
  "vim",
];

// Validate skills config and ensure no reserved skill names are used
export function validateSkillsConfig(
  config: unknown,
): { success: true; data: SkillsConfig } | { success: false; error: string } {
  // First validate the schema
  const result = SkillsConfigSchema.safeParse(config);

  if (!result.success) {
    // Extract and format error message
    const issues = result.error.issues;

    // Look for the most specific error
    let mostSpecificError: (typeof issues)[number] | null = null;
    let mostSpecificPath = "";

    for (const error of issues) {
      if (error.code !== "invalid_union") {
        const path = error.path.join(".");
        if (!mostSpecificError || path.length > mostSpecificPath.length) {
          mostSpecificError = error;
          mostSpecificPath = path;
        }
      }
    }

    // Fall back to the first error if we still don't have one
    if (!mostSpecificError) {
      mostSpecificError = issues[0] ?? null;
    }

    if (!mostSpecificError) {
      return {
        success: false,
        error: "Invalid skills configuration",
      };
    }

    const path = mostSpecificError.path.join(".");
    let message = mostSpecificError.message;

    // Normalize messages for better readability
    if (message.startsWith("Invalid input: ")) {
      message = message.slice("Invalid input: ".length);
      if (message.toLowerCase().startsWith("expected ")) {
        message = message[0]?.toUpperCase() + message.slice(1);
      }
      if (/received undefined\s*$/.test(message)) {
        message = "Required";
      }
    }

    return {
      success: false,
      error: `${path ? `${path}: ` : ""}${message}`,
    };
  }

  // Check for reserved skill names
  for (const skillKey of Object.keys(result.data.skills)) {
    const lowerKey = skillKey.toLowerCase();
    if (RESERVED_SKILL_NAMES.includes(lowerKey)) {
      return {
        success: false,
        error: `Cannot use '${skillKey}' as a skill name (reserved for built-in commands)`,
      };
    }
  }

  // Validate that skill key matches skill name
  for (const [skillKey, skill] of Object.entries(result.data.skills)) {
    if (skill.name !== skillKey) {
      return {
        success: false,
        error: `Skill key '${skillKey}' does not match skill name '${skill.name}'`,
      };
    }
  }

  return {
    success: true,
    data: result.data,
  };
}

// Helper to create an empty skills config
export function createEmptySkillsConfig(): SkillsConfig {
  return { skills: {} };
}

// Helper to add a skill to a config
export function addSkillToConfig(
  config: SkillsConfig,
  skill: UserSkill,
): SkillsConfig {
  return {
    skills: {
      ...config.skills,
      [skill.name]: skill,
    },
  };
}

// Helper to remove a skill from a config
export function removeSkillFromConfig(
  config: SkillsConfig,
  skillName: string,
): SkillsConfig {
  const { [skillName]: _, ...remainingSkills } = config.skills;
  return { skills: remainingSkills };
}

// Helper to update a skill in a config (handles renaming)
export function updateSkillInConfig(
  config: SkillsConfig,
  oldName: string,
  skill: UserSkill,
): SkillsConfig {
  // If the name changed, remove the old one first
  if (oldName !== skill.name) {
    const { [oldName]: _, ...remainingSkills } = config.skills;
    return {
      skills: {
        ...remainingSkills,
        [skill.name]: skill,
      },
    };
  }

  // Otherwise just update in place
  return {
    skills: {
      ...config.skills,
      [skill.name]: skill,
    },
  };
}
