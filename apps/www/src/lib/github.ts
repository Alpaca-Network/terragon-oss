import { db } from "./db";
import {
  getGithubPR,
  getThreadsForGithubPR,
  upsertGithubPR,
} from "@terragon/shared/model/github";
import { Octokit } from "octokit";
import {
  getGithubPRMergeableState,
  getGithubPRStatus,
  getGithubPRChecksStatus,
} from "@terragon/shared/github-api/helpers";
import { getInstallationToken } from "@terragon/shared/github-app";
import { getPostHogServer } from "./posthog-server";
import { publishBroadcastUserMessage } from "@terragon/shared/broadcast-server";
import { BroadcastMessageThreadData } from "@terragon/types/broadcast";
import { updateThread } from "@terragon/shared/model/threads";
import {
  getGitHubAccountIdForUser,
  getUserSettings,
} from "@terragon/shared/model/user";
import { getGitHubUserAccessTokenWithRefresh } from "./github-oauth";
import { env } from "@terragon/env/apps-www";
import { UserFacingError } from "./server-actions";
import { createGitHubClient } from "./github-client";
import { GitHubError, GitHubAuthError, toGitHubError } from "./github-errors";
import { retryGitHubRequest } from "./github-retry";

export function parseRepoFullName(repoFullName: string): [string, string] {
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository full name: ${repoFullName}`);
  }
  return [owner, repo];
}

export async function ensureBranchExists({
  userId,
  repoFullName,
  branchName,
}: {
  userId: string;
  repoFullName: string;
  branchName: string;
}) {
  const [owner, repoName] = parseRepoFullName(repoFullName);
  const octokit = await getOctokitForUserOrThrow({ userId });
  try {
    const branch = await octokit.rest.repos.getBranch({
      owner,
      repo: repoName,
      branch: branchName,
    });
    if (!branch || branch.data.name !== branchName) {
      throw new BranchDoesNotExistError({ repoFullName, branchName });
    }
  } catch (error: any) {
    // If we get a 404, check if the repo has no branches at all
    if (error.status === 404) {
      try {
        // Check if the repository exists and has any branches
        const { data: branches } = await octokit.rest.repos.listBranches({
          owner,
          repo: repoName,
          per_page: 1,
        });

        if (branches.length === 0) {
          // Repository has no branches, create an initial branch
          console.log(
            `Repository ${repoFullName} has no branches. Creating initial branch: ${branchName}`,
          );

          // Create a README file to initialize the branch
          const readmeContent = `# ${repoName}\n\nThis repository was initialized by Terragon.`;

          await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo: repoName,
            path: "README.md",
            message: "Initial commit",
            content: Buffer.from(readmeContent).toString("base64"),
            branch: branchName,
          });

          console.log(
            `Successfully created initial branch ${branchName} in ${repoFullName}`,
          );
          return;
        }
      } catch (innerError) {
        console.error("Error checking/creating branches:", innerError);
      }
    }

    // Re-throw the original error if it's not a case we can handle
    throw new BranchDoesNotExistError({ repoFullName, branchName });
  }
}

export class BranchDoesNotExistError extends UserFacingError {
  constructor({
    repoFullName,
    branchName,
  }: {
    repoFullName: string;
    branchName: string;
  }) {
    super(
      `Branch ${branchName} does not exist in ${repoFullName}. Please try a different branch.`,
    );
  }
}

export async function updateGitHubPR({
  repoFullName,
  prNumber,
  createIfNotFound,
}: {
  repoFullName: string;
  prNumber: number;
  createIfNotFound: boolean;
}) {
  return retryGitHubRequest(
    async () => {
      const [owner, repoName] = parseRepoFullName(repoFullName);
      const octokit = await getOctokitForApp({ owner, repo: repoName });
      const existingPR = await getGithubPR({
        db,
        repoFullName,
        prNumber,
      });
      if (!existingPR && !createIfNotFound) {
        return;
      }
      const pr = await octokit.rest.pulls.get({
        owner,
        repo: repoName,
        pull_number: prNumber,
      });

      const baseRef = pr.data.base.ref;
      const mergeableState = getGithubPRMergeableState(pr.data);
      const status = getGithubPRStatus(pr.data);

      // Also fetch check status
      const checkRuns = await octokit.rest.checks.listForRef({
        owner,
        repo: repoName,
        ref: pr.data.head.sha,
      });

      // Calculate overall check status
      const checksStatus = getGithubPRChecksStatus(checkRuns.data);
      const shouldUpdate =
        !existingPR ||
        existingPR.status !== status ||
        existingPR.baseRef !== baseRef ||
        existingPR.mergeableState !== mergeableState ||
        existingPR.checksStatus !== checksStatus;
      if (!shouldUpdate) {
        return;
      }
      await upsertGithubPR({
        db,
        repoFullName,
        number: prNumber,
        updates: {
          status,
          baseRef,
          mergeableState,
          checksStatus,
        },
      });
      const threads = await getThreadsForGithubPR({
        db,
        repoFullName,
        prNumber,
      });
      // Capture posthog event for each thread where the PR status changed
      for (const thread of threads) {
        getPostHogServer().capture({
          distinctId: thread.userId,
          event: "github_pr_status_changed",
          properties: {
            repoFullName,
            prNumber,
            status,
          },
        });
      }
      // Auto-archive threads for merged or closed PRs if user setting is enabled
      if (status === "merged" || status === "closed") {
        await Promise.all(
          threads.map(async (thread) => {
            if (!thread.archived) {
              const userSettings = await getUserSettings({
                db,
                userId: thread.userId,
              });
              if (userSettings?.autoArchiveMergedPRs) {
                await updateThread({
                  db,
                  userId: thread.userId,
                  threadId: thread.id,
                  updates: {
                    archived: true,
                    updatedAt: new Date(),
                  },
                });
              }
            }
          }),
        );
      }
      // Publish realtime message for each thread where the PR status changed
      const threadIdsByUserId: Record<string, string[]> = {};
      for (const thread of threads) {
        if (!threadIdsByUserId[thread.userId]) {
          threadIdsByUserId[thread.userId] = [];
        }
        threadIdsByUserId[thread.userId]!.push(thread.id);
      }
      await Promise.all(
        Object.entries(threadIdsByUserId).map(async ([userId, threadIds]) => {
          const dataByThreadId: Record<string, BroadcastMessageThreadData> = {};
          for (const threadId of threadIds) {
            dataByThreadId[threadId] = {};
          }
          await publishBroadcastUserMessage({
            type: "user",
            id: userId,
            data: {},
            dataByThreadId,
          });
        }),
      );
    },
    { label: `update-pr:${repoFullName}#${prNumber}` },
  );
}

export async function getOctokitForApp({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}): Promise<Octokit> {
  const githubAccessToken = await getInstallationToken(owner, repo);
  return createGitHubClient({
    auth: githubAccessToken,
    identifier: `app:${owner}/${repo}`,
  });
}

/**
 * Result type for getOctokitForUser to provide explicit error handling.
 */
export type OctokitResult =
  | { success: true; octokit: Octokit }
  | { success: false; error: GitHubError };

/**
 * Get an Octokit instance for a user with explicit error handling.
 * Returns a Result type instead of null to preserve error information.
 */
export async function getOctokitForUser({
  userId,
}: {
  userId: string;
}): Promise<OctokitResult> {
  try {
    const userAccessToken = await getGitHubUserAccessTokenWithRefresh({
      db,
      userId,
      encryptionKey: env.ENCRYPTION_MASTER_KEY,
      githubClientId: env.GITHUB_CLIENT_ID,
      githubClientSecret: env.GITHUB_CLIENT_SECRET,
    });
    if (userAccessToken) {
      return {
        success: true,
        octokit: createGitHubClient({
          auth: userAccessToken,
          identifier: `user:${userId}`,
        }),
      };
    }
    return {
      success: false,
      error: new GitHubAuthError("No GitHub access token found for user"),
    };
  } catch (error) {
    const ghError =
      error instanceof Error && error.message.includes("No GitHub")
        ? new GitHubAuthError(error.message, error)
        : toGitHubError(error);
    return { success: false, error: ghError };
  }
}

export async function getOctokitForUserOrThrow({
  userId,
}: {
  userId: string;
}): Promise<Octokit> {
  const result = await getOctokitForUser({ userId });
  if (!result.success) {
    throw result.error;
  }
  return result.octokit;
}

export async function getIsPRAuthor({
  userId,
  repoFullName,
  prNumber,
}: {
  userId: string;
  repoFullName: string;
  prNumber: number;
}): Promise<boolean> {
  try {
    const [owner, repoName] = parseRepoFullName(repoFullName);
    const [octokit, prAuthorGitHubAccountId] = await Promise.all([
      getOctokitForApp({ owner, repo: repoName }),
      getGitHubAccountIdForUser({
        db,
        userId,
      }),
    ]);
    const pr = await octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
    });
    return pr.data.user.id + "" === prAuthorGitHubAccountId;
  } catch (error) {
    console.error(
      `Failed to get PR author for ${repoFullName} #${prNumber}:`,
      error,
    );
    return false;
  }
}

export async function getPRAuthorGitHubUsername({
  repoFullName,
  prNumber,
}: {
  repoFullName: string;
  prNumber: number;
}): Promise<string> {
  const [owner, repoName] = parseRepoFullName(repoFullName);
  const octokit = await getOctokitForApp({ owner, repo: repoName });
  const pr = await octokit.rest.pulls.get({
    owner,
    repo: repoName,
    pull_number: prNumber,
  });
  return pr.data.user.login;
}

export async function getIsIssueAuthor({
  userId,
  repoFullName,
  issueNumber,
}: {
  userId: string;
  repoFullName: string;
  issueNumber: number;
}): Promise<boolean> {
  try {
    const [owner, repoName] = parseRepoFullName(repoFullName);
    const [octokit, userGithubAccount] = await Promise.all([
      getOctokitForApp({ owner, repo: repoName }),
      getGitHubAccountIdForUser({
        db,
        userId,
      }),
    ]);
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo: repoName,
      issue_number: issueNumber,
    });
    return issue.user?.id + "" === userGithubAccount;
  } catch (error) {
    console.error(
      `Failed to get issue author for ${repoFullName} #${issueNumber}:`,
      error,
    );
    return false;
  }
}

export async function getIssueAuthorGitHubUsername({
  repoFullName,
  issueNumber,
}: {
  repoFullName: string;
  issueNumber: number;
}): Promise<string> {
  const [owner, repoName] = parseRepoFullName(repoFullName);
  const octokit = await getOctokitForApp({ owner, repo: repoName });
  const issue = await octokit.rest.issues.get({
    owner,
    repo: repoName,
    issue_number: issueNumber,
  });
  return issue.data.user?.login || "";
}

export async function getDefaultBranchForRepo({
  userId,
  repoFullName,
}: {
  userId: string;
  repoFullName: string;
}): Promise<string> {
  const octokit = await getOctokitForUserOrThrow({ userId });
  const [owner, repo] = parseRepoFullName(repoFullName);
  try {
    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo,
    });
    return repoData.default_branch || "main";
  } catch (error) {
    console.error(`Failed to get default branch for ${repoFullName}:`, error);
    return "main";
  }
}

export async function getExistingPRForBranch({
  repoFullName,
  headBranchName,
  baseBranchName,
}: {
  repoFullName: string;
  headBranchName: string;
  baseBranchName: string;
}) {
  const [owner, repo] = parseRepoFullName(repoFullName);
  const octokit = await getOctokitForApp({ owner, repo });
  try {
    const existingPr = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "open",
      head: headBranchName,
      base: baseBranchName,
    });
    // Filter for exact branch match
    const exactMatchPr = existingPr.data.find(
      (pr) => pr.head.ref === headBranchName.trim(),
    );
    return exactMatchPr || null;
  } catch (error) {
    console.error("Error finding associated PR:", error);
  }
}

export async function findAndAssociatePR({
  userId,
  threadId,
  repoFullName,
  headBranchName,
  baseBranchName,
}: {
  userId: string;
  threadId: string;
  repoFullName: string;
  headBranchName: string;
  baseBranchName: string;
}) {
  console.log("findAndAssociatePR", {
    userId,
    threadId,
    repoFullName,
    headBranchName,
    baseBranchName,
  });
  const existingPr = await getExistingPRForBranch({
    repoFullName,
    headBranchName,
    baseBranchName,
  });
  if (!existingPr) {
    return;
  }
  await Promise.all([
    updateThread({
      db,
      userId,
      threadId,
      updates: {
        githubPRNumber: existingPr.number,
      },
    }),
    upsertGithubPR({
      db,
      repoFullName,
      number: existingPr.number,
      updates: {
        status: getGithubPRStatus(existingPr),
      },
    }),
  ]);
}
