"use server";

import { cache } from "react";
import { userOnlyAction } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { getOctokitForApp, parseRepoFullName } from "@/lib/github";
import { getThreadMinimal } from "@terragon/shared/model/threads";
import { aggregatePRHeader } from "@terragon/shared/github/pr-feedback";
import type { PRHeader } from "@terragon/shared/db/types";
import { UserFacingError } from "@/lib/server-actions";

type GetPRHeaderParams =
  | { threadId: string }
  | { repoFullName: string; prNumber: number };

export type GetPRHeaderResult = PRHeader;

/**
 * Fetches lightweight PR header data for fast initial render.
 * This includes: prNumber, prUrl, prTitle, branches, merge status.
 * Designed to be the first query in progressive loading.
 */
export const getPRHeader = cache(
  userOnlyAction(
    async function getPRHeader(
      userId: string,
      params: GetPRHeaderParams,
    ): Promise<GetPRHeaderResult> {
      let repoFullName: string;
      let prNumber: number;

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
        prNumber = thread.githubPRNumber;
      } else {
        repoFullName = params.repoFullName;
        prNumber = params.prNumber;
      }

      const [owner, repo] = parseRepoFullName(repoFullName);

      try {
        const octokit = await getOctokitForApp({ owner, repo });
        return await aggregatePRHeader(octokit, owner, repo, prNumber);
      } catch (error: any) {
        if (error.status === 404) {
          throw new UserFacingError(
            `PR #${prNumber} not found in ${repoFullName}`,
          );
        }
        throw new UserFacingError(
          `Failed to fetch PR header: ${error.message}`,
        );
      }
    },
    { defaultErrorMessage: "Failed to fetch PR header" },
  ),
);
