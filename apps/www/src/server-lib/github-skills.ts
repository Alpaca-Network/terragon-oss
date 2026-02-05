import { getOctokitForUserOrThrow, parseRepoFullName } from "@/lib/github";
import { parseSkillContent } from "@terragon/agent/skill-frontmatter";

export type SkillContentResult = {
  name: string;
  description: string;
  argumentHint?: string;
  disableModelInvocation: boolean;
  userInvocable: boolean;
  content: string;
  filePath: string;
} | null;

/**
 * Internal function to fetch skill content (used by server-side code).
 * This is NOT a server action - it's for direct server-side usage.
 */
export async function getSkillContentInternal(
  userId: string,
  repoFullName: string,
  branchName: string,
  skillName: string,
): Promise<SkillContentResult> {
  const [owner, repo] = parseRepoFullName(repoFullName);
  const octokit = await getOctokitForUserOrThrow({ userId });
  const filePath = `.claude/skills/${skillName}/SKILL.md`;

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branchName,
    });

    if ("content" in data && typeof data.content === "string") {
      const rawContent = Buffer.from(data.content, "base64").toString("utf-8");
      const { frontmatter, body } = parseSkillContent(rawContent);

      return {
        name: frontmatter.name || skillName,
        description: frontmatter.description || "Custom skill",
        argumentHint: frontmatter.argumentHint,
        disableModelInvocation: frontmatter.disableModelInvocation === true,
        userInvocable: frontmatter.userInvocable !== false,
        content: body,
        filePath,
      };
    }
    return null;
  } catch (error: any) {
    if (error?.status === 404) return null;
    throw error;
  }
}
