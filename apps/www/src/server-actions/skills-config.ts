"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  getEnvironment,
  updateEnvironment,
} from "@terragon/shared/model/environments";
import { encryptValue } from "@terragon/utils/encryption";
import { env } from "@terragon/env/apps-www";
import {
  SkillsConfig,
  UserSkill,
  validateSkillsConfig,
} from "@terragon/sandbox/skills-config";
import { getPostHogServer } from "@/lib/posthog-server";
import { UserFacingError } from "@/lib/server-actions";
import { getAllUserConfiguredSkills } from "@/server-lib/user-skills";
import type { SkillMetadata } from "./github-skills";

export const updateSkillsConfig = userOnlyAction(
  async function updateSkillsConfig(
    userId: string,
    {
      environmentId,
      skillsConfig,
    }: {
      environmentId: string;
      skillsConfig: SkillsConfig;
    },
  ) {
    // Verify the user owns this environment
    const existingEnvironment = await getEnvironment({
      db,
      environmentId,
      userId,
    });
    if (!existingEnvironment) {
      throw new UserFacingError("Environment not found");
    }

    // Validate the skills config using the shared validator
    const validationResult = validateSkillsConfig(skillsConfig);
    if (!validationResult.success) {
      throw new UserFacingError(validationResult.error);
    }

    // Encrypt the skills config before storing
    const encryptedConfig = encryptValue(
      JSON.stringify(skillsConfig),
      env.ENCRYPTION_MASTER_KEY,
    );

    // Update the environment with the encrypted skills config
    await updateEnvironment({
      db,
      userId,
      environmentId,
      updates: {
        skillsConfigEncrypted: encryptedConfig,
      },
    });

    // Track skills config save
    const skillNames = skillsConfig?.skills
      ? Object.keys(skillsConfig.skills)
      : [];

    getPostHogServer().capture({
      distinctId: userId,
      event: "skills_config_saved",
      properties: {
        environmentId,
        repoFullName: existingEnvironment.repoFullName,
        skillNames,
        skillCount: skillNames.length,
      },
    });

    return { success: true };
  },
  { defaultErrorMessage: "Failed to update skills config" },
);

/**
 * List all user-configured skills for a repository.
 * Merges global skills with repo-specific skills.
 * Returns in SkillMetadata format for compatibility with GitHub skills.
 */
export const listUserConfiguredSkills = userOnlyAction(
  async function listUserConfiguredSkills(
    userId: string,
    {
      repoFullName,
    }: {
      repoFullName: string;
    },
  ): Promise<SkillMetadata[]> {
    const skills = await getAllUserConfiguredSkills({ userId, repoFullName });

    return Object.values(skills).map((skill: UserSkill) => ({
      name: skill.name,
      description: skill.description,
      argumentHint: skill.argumentHint,
      disableModelInvocation: skill.disableModelInvocation,
      userInvocable: skill.userInvocable,
      filePath: `[user-configured:${skill.name}]`,
    }));
  },
  { defaultErrorMessage: "Failed to list user-configured skills" },
);
