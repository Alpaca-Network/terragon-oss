import { db } from "@/lib/db";
import {
  getOrCreateGlobalEnvironment,
  getEnvironmentForUserRepo,
  getDecryptedSkillsConfig,
} from "@terragon/shared/model/environments";
import { env } from "@terragon/env/apps-www";
import type { UserSkill } from "@terragon/sandbox/skills-config";
import type { SkillContentResult } from "./github-skills";

/**
 * Get a single user-configured skill by name.
 * Checks repo-specific environment first, then falls back to global environment.
 */
export async function getUserConfiguredSkill({
  userId,
  repoFullName,
  skillName,
}: {
  userId: string;
  repoFullName: string;
  skillName: string;
}): Promise<UserSkill | null> {
  // Check repo-specific environment first
  const repoEnv = await getEnvironmentForUserRepo({ db, userId, repoFullName });
  if (repoEnv) {
    const repoSkillsConfig = await getDecryptedSkillsConfig({
      db,
      userId,
      environmentId: repoEnv.id,
      encryptionMasterKey: env.ENCRYPTION_MASTER_KEY,
    });
    const skill = repoSkillsConfig?.skills[skillName];
    if (skill) {
      return skill;
    }
  }

  // Fall back to global environment
  const globalEnv = await getOrCreateGlobalEnvironment({ db, userId });
  const globalSkillsConfig = await getDecryptedSkillsConfig({
    db,
    userId,
    environmentId: globalEnv.id,
    encryptionMasterKey: env.ENCRYPTION_MASTER_KEY,
  });

  return globalSkillsConfig?.skills[skillName] ?? null;
}

/**
 * Get all user-configured skills merged from global and repo-specific environments.
 * Repo-specific skills override global skills with the same name.
 */
export async function getAllUserConfiguredSkills({
  userId,
  repoFullName,
}: {
  userId: string;
  repoFullName: string;
}): Promise<Record<string, UserSkill>> {
  const mergedSkills: Record<string, UserSkill> = {};

  // Get global skills first (lowest priority)
  const globalEnv = await getOrCreateGlobalEnvironment({ db, userId });
  const globalSkillsConfig = await getDecryptedSkillsConfig({
    db,
    userId,
    environmentId: globalEnv.id,
    encryptionMasterKey: env.ENCRYPTION_MASTER_KEY,
  });
  if (globalSkillsConfig?.skills) {
    Object.assign(mergedSkills, globalSkillsConfig.skills);
  }

  // Get repo-specific skills (override global)
  const repoEnv = await getEnvironmentForUserRepo({ db, userId, repoFullName });
  if (repoEnv) {
    const repoSkillsConfig = await getDecryptedSkillsConfig({
      db,
      userId,
      environmentId: repoEnv.id,
      encryptionMasterKey: env.ENCRYPTION_MASTER_KEY,
    });
    if (repoSkillsConfig?.skills) {
      Object.assign(mergedSkills, repoSkillsConfig.skills);
    }
  }

  return mergedSkills;
}

/**
 * Convert a UserSkill to the SkillContentResult format used by the skill invocation handler.
 * This allows user-configured skills to be processed the same way as GitHub-based skills.
 */
export function userSkillToContentResult(skill: UserSkill): SkillContentResult {
  return {
    name: skill.name,
    description: skill.description,
    argumentHint: skill.argumentHint,
    disableModelInvocation: skill.disableModelInvocation,
    userInvocable: skill.userInvocable,
    content: skill.content,
    filePath: `[user-configured:${skill.name}]`,
  };
}

/**
 * Get user-configured skill as SkillContentResult for the skill invocation handler.
 * Returns null if the skill doesn't exist or is not user-invocable.
 */
export async function getUserSkillContent({
  userId,
  repoFullName,
  skillName,
}: {
  userId: string;
  repoFullName: string;
  skillName: string;
}): Promise<SkillContentResult | null> {
  const skill = await getUserConfiguredSkill({
    userId,
    repoFullName,
    skillName,
  });
  if (!skill) {
    return null;
  }

  // Check if the skill is user-invocable
  if (!skill.userInvocable) {
    return null;
  }

  return userSkillToContentResult(skill);
}
