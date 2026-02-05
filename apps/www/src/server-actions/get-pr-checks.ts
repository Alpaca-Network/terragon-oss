"use server";

import { cache } from "react";
import { userOnlyAction } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { getOctokitForApp, parseRepoFullName } from "@/lib/github";
import { getThreadMinimal } from "@terragon/shared/model/threads";
import {
  aggregatePRChecks,
  aggregatePRHeader,
} from "@terragon/shared/github/pr-feedback";
import type { PRChecksData } from "@terragon/shared/db/types";
import { UserFacingError } from "@/lib/server-actions";

type GetPRChecksParams =
  | { threadId: string; headSha?: string }
  | { repoFullName: string; headSha: string };

export type GetPRChecksResult = PRChecksData;

/**
 * Fetches PR check runs and coverage check.
 * Requires headSha - either provided directly or fetched via threadId.
 * This is one of the tab-specific queries for progressive loading.
 */
export const getPRChecks = cache(
  userOnlyAction(
    async function getPRChecks(
      userId: string,
      params: GetPRChecksParams,
    ): Promise<GetPRChecksResult> {
      let repoFullName: string;
      let headSha: string;

      if ("threadId" in params) {
        const thread = await getThreadMinimal({
          db,
          userId,
          threadId: params.threadId,
        });

        if (!thread) {
          throw new UserFacingError("Task not found");
        }

        if (!thread.githubPRNumber) {
          throw new UserFacingError("This task does not have an associated PR");
        }

        repoFullName = thread.githubRepoFullName;

        // If headSha is provided, use it; otherwise fetch from PR
        if (params.headSha) {
          headSha = params.headSha;
        } else {
          const [owner, repo] = parseRepoFullName(repoFullName);
          const octokit = await getOctokitForApp({ owner, repo });
          const header = await aggregatePRHeader(
            octokit,
            owner,
            repo,
            thread.githubPRNumber,
          );
          headSha = header.headSha;
        }
      } else {
        repoFullName = params.repoFullName;
        headSha = params.headSha;
      }

      const [owner, repo] = parseRepoFullName(repoFullName);

      try {
        const octokit = await getOctokitForApp({ owner, repo });
        return await aggregatePRChecks(octokit, owner, repo, headSha);
      } catch (error: any) {
        if (error.status === 404) {
          throw new UserFacingError(`Checks not found for ${repoFullName}`);
        }
        throw new UserFacingError(
          `Failed to fetch PR checks: ${error.message}`,
        );
      }
    },
    { defaultErrorMessage: "Failed to fetch PR checks" },
  ),
);
