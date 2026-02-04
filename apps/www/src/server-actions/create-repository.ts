"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { UserFacingError, unwrapResult } from "@/lib/server-actions";
import { Octokit } from "octokit";
import { getGitHubUserAccessTokenWithRefresh } from "@/lib/github-oauth";
import {
  getUserFlags,
  updateUserFlags,
} from "@terragon/shared/model/user-flags";
import { getOrCreateEnvironment } from "@terragon/shared/model/environments";
import { getPostHogServer } from "@/lib/posthog-server";
import { newThread } from "./new-thread";
import { SelectedAIModels } from "@terragon/agent/types";
import { db } from "@/lib/db";
import { env } from "@terragon/env/apps-www";

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
  const userFlags = await getUserFlags({ db, userId });
  const today = new Date().toDateString();
  const lastResetDate = userFlags?.repoCreationResetDate?.toDateString();

  if (lastResetDate !== today) {
    // Reset counter for new day
    await updateUserFlags({
      db,
      userId,
      updates: {
        repoCreationCount: 0,
        repoCreationResetDate: new Date(),
      },
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
  await updateUserFlags({
    db,
    userId,
    updates: {
      repoCreationCount: currentCount + 1,
    },
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
  await updateUserFlags({
    db,
    userId,
    updates: {
      selectedRepo: repoFullName,
      selectedBranch: defaultBranch,
    },
  });
}

/**
 * Create a new repository from a GitHub template or by forking
 * If the source repo is a GitHub template, uses the template API.
 * Otherwise, falls back to forking the repository.
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
    const token = await getGitHubUserAccessTokenWithRefresh({
      db,
      userId,
      encryptionKey: env.ENCRYPTION_MASTER_KEY,
      githubClientId: env.GITHUB_CLIENT_ID,
      githubClientSecret: env.GITHUB_CLIENT_SECRET,
    });
    const octokit = new Octokit({ auth: token });

    // Get user's GitHub username
    const { data: user } = await octokit.rest.users.getAuthenticated();

    try {
      // First, check if the source repository is a GitHub template
      const { data: sourceRepo } = await octokit.rest.repos.get({
        owner: templateOwner,
        repo: templateRepo,
      });

      let repo;
      let creationMethod: "template" | "fork";

      if (sourceRepo.is_template) {
        // Source repo is a template, use the template API
        const { data: templateRepoData } =
          await octokit.rest.repos.createUsingTemplate({
            template_owner: templateOwner,
            template_repo: templateRepo,
            owner: user.login,
            name: repoName,
            private: isPrivate,
            description: `Created from ${templateOwner}/${templateRepo}`,
          });
        repo = templateRepoData;
        creationMethod = "template";
      } else {
        // Source repo is not a template, fall back to forking
        const { data: forkedRepo } = await octokit.rest.repos.createFork({
          owner: templateOwner,
          repo: templateRepo,
          name: repoName,
          default_branch_only: true,
        });

        // Poll for fork readiness with exponential backoff instead of fixed delay
        // GitHub fork creation is async and timing varies by repo size
        const maxAttempts = 5;
        const baseDelayMs = 1000;
        let forkReady = false;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const { data: checkRepo } = await octokit.rest.repos.get({
              owner: user.login,
              repo: forkedRepo.name,
            });
            // Fork is ready when we can fetch it and it has content
            if (checkRepo.size !== undefined) {
              forkReady = true;
              break;
            }
          } catch {
            // Fork not ready yet, continue polling
          }

          if (attempt < maxAttempts) {
            const delay = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        if (!forkReady) {
          console.warn(
            `Fork ${user.login}/${forkedRepo.name} may not be fully ready after polling`,
          );
        }

        // Track whether we successfully made the repo private
        let madePrivate = forkedRepo.private;

        // Update the forked repo's visibility if needed (forks default to same as parent)
        // Note: Can only make a fork private if you have a paid plan and the source allows it
        if (isPrivate && !forkedRepo.private) {
          try {
            await octokit.rest.repos.update({
              owner: user.login,
              repo: forkedRepo.name,
              private: true,
            });
            madePrivate = true;
          } catch {
            // If we can't make it private, continue anyway but track this
            console.warn(
              "Could not make forked repository private. Continuing with public visibility.",
            );
            madePrivate = false;
          }
        }

        // Fetch the updated repo info
        const { data: updatedRepo } = await octokit.rest.repos.get({
          owner: user.login,
          repo: forkedRepo.name,
        });

        repo = updatedRepo;
        creationMethod = "fork";

        // If user requested private but we couldn't make it private, note this for later
        if (isPrivate && !madePrivate && !updatedRepo.private) {
          // Store this info to include in response message
          (repo as any)._privacyWarning = true;
        }
      }

      const repoFullName = repo.full_name;
      const defaultBranch = repo.default_branch || "main";

      // Increment rate limit counter
      await incrementRepoCreationCount(userId, currentCount);

      // Create environment for the repo
      await getOrCreateEnvironment({
        db,
        userId,
        repoFullName,
      });

      // Set as selected repo
      await selectRepo(userId, repoFullName, defaultBranch);

      // Auto-create task with suggested prompt
      const threadResult = await newThread({
        message: {
          type: "user",
          model: null,
          parts: [{ type: "text", text: suggestedFirstTask }],
        },
        githubRepoFullName: repoFullName,
        branchName: defaultBranch,
        selectedModels,
      });
      const thread = unwrapResult(threadResult);

      // Track event
      const posthog = getPostHogServer();
      posthog.capture({
        distinctId: userId,
        event: "template_repo_created",
        properties: {
          template: `${templateOwner}/${templateRepo}`,
          repoName,
          isPrivate,
          creationMethod,
        },
      });

      // Check if there was a privacy warning
      const hasPrivacyWarning = (repo as any)._privacyWarning === true;
      const message = hasPrivacyWarning
        ? "Repository created and task started! Note: The repository could not be made private (requires a paid GitHub plan for private forks)."
        : "Repository created and task started!";

      return {
        repoFullName,
        threadId: thread.threadId,
        message,
      };
    } catch (error: any) {
      console.error("Failed to create repository from template:", error);

      if (error.status === 404) {
        throw new UserFacingError(
          `Repository ${templateOwner}/${templateRepo} not found.`,
        );
      }

      if (error.status === 422) {
        throw new UserFacingError(
          `Repository name "${repoName}" is already taken or invalid.`,
        );
      }

      if (error.status === 403) {
        throw new UserFacingError(
          `Access denied. The repository ${templateOwner}/${templateRepo} may not allow forking, or you may have reached your repository limit.`,
        );
      }

      throw new UserFacingError(
        `Failed to create repository: ${error.message || "Unknown error"}`,
      );
    }
  },
  { defaultErrorMessage: "Failed to create repository from template" },
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
    const token = await getGitHubUserAccessTokenWithRefresh({
      db,
      userId,
      encryptionKey: env.ENCRYPTION_MASTER_KEY,
      githubClientId: env.GITHUB_CLIENT_ID,
      githubClientSecret: env.GITHUB_CLIENT_SECRET,
    });
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
        db,
        userId,
        repoFullName,
      });

      // Set as selected repo
      await selectRepo(userId, repoFullName, defaultBranch);

      // Auto-create task with suggested prompt
      const threadResult = await newThread({
        message: {
          type: "user",
          model: null,
          parts: [{ type: "text", text: suggestedFirstTask }],
        },
        githubRepoFullName: repoFullName,
        branchName: defaultBranch,
        selectedModels,
      });
      const thread = unwrapResult(threadResult);

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
  { defaultErrorMessage: "Failed to create blank repository" },
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
    const token = await getGitHubUserAccessTokenWithRefresh({
      db,
      userId,
      encryptionKey: env.ENCRYPTION_MASTER_KEY,
      githubClientId: env.GITHUB_CLIENT_ID,
      githubClientSecret: env.GITHUB_CLIENT_SECRET,
    });
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
            owner: item.owner?.login || "",
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
  { defaultErrorMessage: "Failed to search templates" },
);
