"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { UserFacingError } from "@/lib/server-actions";
import { Octokit } from "octokit";
import { getGitHubUserAccessTokenWithRefresh } from "@/lib/github-oauth";
import { getUserFlags, updateUserFlags } from "@terragon/shared/model/user";
import { getOrCreateEnvironment } from "@terragon/shared/model/environments";
import { getPostHogServer } from "@/lib/posthog-server";
import { newThread } from "./new-thread";
import { SelectedAIModels } from "@terragon/agent/types";

interface CreateRepoFromTemplateArgs {
  templateOwner: string;
  templateRepo: string;
  repoName: string;
  isPrivate: boolean;
  suggestedFirstTask: string;
  selectedModels?: SelectedAIModels;
}

interface CreateBlankRepoArgs {
  repoName: string;
  description?: string;
  isPrivate: boolean;
  suggestedFirstTask: string;
  selectedModels?: SelectedAIModels;
}

interface SearchTemplateArgs {
  query: string;
}

const MAX_REPOS_PER_DAY = 3;

/**
 * Check and enforce rate limiting for repo creation (3 per day per user)
 */
async function checkRepoCreationRateLimit(userId: string) {
  const userFlags = await getUserFlags(userId);
  const today = new Date().toDateString();
  const lastResetDate = userFlags?.repoCreationResetDate?.toDateString();

  if (lastResetDate !== today) {
    // Reset counter for new day
    await updateUserFlags(userId, {
      repoCreationCount: 0,
      repoCreationResetDate: new Date(),
    });
    return 0; // Return current count after reset
  }

  const currentCount = userFlags?.repoCreationCount ?? 0;
  if (currentCount >= MAX_REPOS_PER_DAY) {
    throw new UserFacingError(
      `You've reached the daily limit of ${MAX_REPOS_PER_DAY} new repositories. Try again tomorrow.`,
    );
  }

  return currentCount;
}

/**
 * Increment the repo creation counter
 */
async function incrementRepoCreationCount(
  userId: string,
  currentCount: number,
) {
  await updateUserFlags(userId, {
    repoCreationCount: currentCount + 1,
  });
}

/**
 * Update the selected repo and branch for the user
 */
async function selectRepo(
  userId: string,
  repoFullName: string,
  defaultBranch: string,
) {
  await updateUserFlags(userId, {
    selectedRepo: repoFullName,
    selectedBranch: defaultBranch,
  });
}

/**
 * Create a new repository from a GitHub template
 */
export const createRepositoryFromTemplate = userOnlyAction(
  async function createRepositoryFromTemplate(
    userId: string,
    {
      templateOwner,
      templateRepo,
      repoName,
      isPrivate,
      suggestedFirstTask,
      selectedModels,
    }: CreateRepoFromTemplateArgs,
  ) {
    // Check rate limit
    const currentCount = await checkRepoCreationRateLimit(userId);

    // Get user's GitHub token
    const token = await getGitHubUserAccessTokenWithRefresh(userId);
    const octokit = new Octokit({ auth: token });

    // Get user's GitHub username
    const { data: user } = await octokit.rest.users.getAuthenticated();

    try {
      // Create repo from template
      const { data: repo } = await octokit.rest.repos.createUsingTemplate({
        template_owner: templateOwner,
        template_repo: templateRepo,
        owner: user.login,
        name: repoName,
        private: isPrivate,
        description: `Created from ${templateOwner}/${templateRepo}`,
      });

      const repoFullName = repo.full_name;
      const defaultBranch = repo.default_branch || "main";

      // Increment rate limit counter
      await incrementRepoCreationCount(userId, currentCount);

      // Create environment for the repo
      await getOrCreateEnvironment({
        userId,
        repoFullName,
      });

      // Set as selected repo
      await selectRepo(userId, repoFullName, defaultBranch);

      // Auto-create task with suggested prompt
      const thread = await newThread(userId, {
        message: suggestedFirstTask,
        githubRepoFullName: repoFullName,
        branchName: defaultBranch,
        selectedModels,
      });

      // Track event
      const posthog = getPostHogServer();
      posthog.capture({
        distinctId: userId,
        event: "template_repo_created",
        properties: {
          template: `${templateOwner}/${templateRepo}`,
          repoName,
          isPrivate,
        },
      });

      return {
        success: true,
        repoFullName,
        threadId: thread.threadId,
        message: "Repository created and task started!",
      };
    } catch (error: any) {
      console.error("Failed to create repository from template:", error);

      if (error.status === 404) {
        throw new UserFacingError(
          `Template repository ${templateOwner}/${templateRepo} not found or is not a template.`,
        );
      }

      if (error.status === 422) {
        throw new UserFacingError(
          `Repository name "${repoName}" is already taken or invalid.`,
        );
      }

      throw new UserFacingError(
        `Failed to create repository: ${error.message || "Unknown error"}`,
      );
    }
  },
);

/**
 * Create a blank repository
 */
export const createBlankRepository = userOnlyAction(
  async function createBlankRepository(
    userId: string,
    {
      repoName,
      description,
      isPrivate,
      suggestedFirstTask,
      selectedModels,
    }: CreateBlankRepoArgs,
  ) {
    // Check rate limit
    const currentCount = await checkRepoCreationRateLimit(userId);

    // Get user's GitHub token
    const token = await getGitHubUserAccessTokenWithRefresh(userId);
    const octokit = new Octokit({ auth: token });

    try {
      // Create blank repo
      const { data: repo } =
        await octokit.rest.repos.createForAuthenticatedUser({
          name: repoName,
          description: description || "Created with Gatewayz",
          private: isPrivate,
          auto_init: true, // Creates initial README.md
        });

      const repoFullName = repo.full_name;
      const defaultBranch = repo.default_branch || "main";

      // Increment rate limit counter
      await incrementRepoCreationCount(userId, currentCount);

      // Create environment for the repo
      await getOrCreateEnvironment({
        userId,
        repoFullName,
      });

      // Set as selected repo
      await selectRepo(userId, repoFullName, defaultBranch);

      // Auto-create task with suggested prompt
      const thread = await newThread(userId, {
        message: suggestedFirstTask,
        githubRepoFullName: repoFullName,
        branchName: defaultBranch,
        selectedModels,
      });

      // Track event
      const posthog = getPostHogServer();
      posthog.capture({
        distinctId: userId,
        event: "blank_repo_created",
        properties: {
          repoName,
          isPrivate,
        },
      });

      return {
        success: true,
        repoFullName,
        threadId: thread.threadId,
        message: "Repository created and task started!",
      };
    } catch (error: any) {
      console.error("Failed to create blank repository:", error);

      if (error.status === 422) {
        throw new UserFacingError(
          `Repository name "${repoName}" is already taken or invalid.`,
        );
      }

      throw new UserFacingError(
        `Failed to create repository: ${error.message || "Unknown error"}`,
      );
    }
  },
);

/**
 * Search for GitHub template repositories
 */
export const searchGitHubTemplate = userOnlyAction(
  async function searchGitHubTemplate(
    userId: string,
    { query }: SearchTemplateArgs,
  ) {
    // Get user's GitHub token
    const token = await getGitHubUserAccessTokenWithRefresh(userId);
    const octokit = new Octokit({ auth: token });

    try {
      // Check if query is in "owner/repo" format
      const [owner, repo] = query.includes("/")
        ? query.split("/")
        : [null, query];

      if (owner && repo) {
        // Direct repo lookup
        const { data } = await octokit.rest.repos.get({ owner, repo });

        // Track search
        const posthog = getPostHogServer();
        posthog.capture({
          distinctId: userId,
          event: "template_search_performed",
          properties: { query, resultCount: 1 },
        });

        return {
          repos: [
            {
              full_name: data.full_name,
              name: data.name,
              description: data.description,
              owner: data.owner.login,
              stargazers_count: data.stargazers_count,
              language: data.language,
              is_template: data.is_template,
            },
          ],
        };
      } else {
        // Search for templates
        const { data } = await octokit.rest.search.repos({
          q: `${query} template in:name,description`,
          sort: "stars",
          per_page: 10,
        });

        // Track search
        const posthog = getPostHogServer();
        posthog.capture({
          distinctId: userId,
          event: "template_search_performed",
          properties: { query, resultCount: data.items.length },
        });

        return {
          repos: data.items.map((item) => ({
            full_name: item.full_name,
            name: item.name,
            description: item.description,
            owner: item.owner.login,
            stargazers_count: item.stargazers_count,
            language: item.language,
            is_template: item.is_template,
          })),
        };
      }
    } catch (error: any) {
      console.error("Failed to search GitHub templates:", error);

      if (error.status === 404) {
        return { repos: [] };
      }

      throw new UserFacingError(
        `Failed to search templates: ${error.message || "Unknown error"}`,
      );
    }
  },
);
