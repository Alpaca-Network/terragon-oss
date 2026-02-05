"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { getOctokitForUserOrThrow, parseRepoFullName } from "@/lib/github";
import { parseSkillFrontmatter } from "@terragon/agent/skill-frontmatter";
import {
  getSkillContentInternal,
  type SkillContentResult,
} from "@/server-lib/github-skills";

export type { SkillContentResult };

export type SkillMetadata = {
  name: string;
  description: string;
  argumentHint?: string;
  disableModelInvocation: boolean;
  userInvocable: boolean;
  filePath: string;
};

/**
 * List all skills in a repository with their metadata.
 * Fetches all SKILL.md files from .claude/skills/ directories.
 */
export const listSkillsWithMetadata = userOnlyAction(
  async function listSkillsWithMetadata(
    userId: string,
    {
      repoFullName,
      branchName,
    }: {
      repoFullName: string;
      branchName: string;
    },
  ): Promise<SkillMetadata[]> {
    return fetchSkillsMetadataInternal(userId, repoFullName, branchName);
  },
  { defaultErrorMessage: "Failed to list skills from GitHub" },
);

/**
 * Fetch full skill content for invocation.
 * Returns the skill's frontmatter metadata and body content.
 */
export const getSkillContent = userOnlyAction(
  async function getSkillContent(
    userId: string,
    {
      repoFullName,
      branchName,
      skillName,
    }: {
      repoFullName: string;
      branchName: string;
      skillName: string;
    },
  ): Promise<SkillContentResult> {
    return getSkillContentInternal(userId, repoFullName, branchName, skillName);
  },
  { defaultErrorMessage: "Failed to fetch skill content from GitHub" },
);

/**
 * Internal function to fetch skill metadata (used by both server actions).
 */
async function fetchSkillsMetadataInternal(
  userId: string,
  repoFullName: string,
  branchName: string,
): Promise<SkillMetadata[]> {
  const [owner, repo] = parseRepoFullName(repoFullName);
  const octokit = await getOctokitForUserOrThrow({ userId });

  try {
    // Get the tree to find skill directories
    const { data: tree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: branchName,
      recursive: "true",
    });

    // Find all SKILL.md files in .claude/skills/*/
    const skillFiles = tree.tree.filter(
      (item) =>
        item.path?.match(/^\.claude\/skills\/[^/]+\/SKILL\.md$/) &&
        item.type === "blob",
    );

    if (skillFiles.length === 0) {
      return [];
    }

    // Fetch content for each skill
    const skillsOrNull = await Promise.all(
      skillFiles.map(async (file): Promise<SkillMetadata | null> => {
        const skillDirName = file.path!.split("/")[2];
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.path!,
            ref: branchName,
          });

          if ("content" in data && typeof data.content === "string") {
            const content = Buffer.from(data.content, "base64").toString(
              "utf-8",
            );
            const frontmatter = parseSkillFrontmatter(content);

            return {
              name: frontmatter.name || skillDirName || "unknown",
              description: frontmatter.description || "Custom skill",
              argumentHint: frontmatter.argumentHint,
              disableModelInvocation:
                frontmatter.disableModelInvocation === true,
              userInvocable: frontmatter.userInvocable !== false,
              filePath: file.path!,
            };
          }
        } catch (e) {
          console.error(`Failed to fetch skill ${skillDirName}:`, e);
        }
        return null;
      }),
    );

    return skillsOrNull.filter((s): s is SkillMetadata => s !== null);
  } catch (error: unknown) {
    // If .claude/skills directory doesn't exist, return empty array
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      return [];
    }
    throw error;
  }
}

/**
 * Get skill descriptions for model context injection.
 * Returns only skills that can be model-invoked (disable-model-invocation !== true).
 */
export const getSkillDescriptionsForModel = userOnlyAction(
  async function getSkillDescriptionsForModel(
    userId: string,
    {
      repoFullName,
      branchName,
    }: {
      repoFullName: string;
      branchName: string;
    },
  ): Promise<{ name: string; description: string }[]> {
    const skills = await fetchSkillsMetadataInternal(
      userId,
      repoFullName,
      branchName,
    );

    // Filter out skills with disable-model-invocation: true
    return skills
      .filter((skill) => !skill.disableModelInvocation)
      .map((skill) => ({
        name: skill.name,
        description: skill.description,
      }));
  },
  { defaultErrorMessage: "Failed to get skill descriptions" },
);
