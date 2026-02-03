import { Octokit } from "octokit";
import type { Endpoints } from "@octokit/types";

const MERGEABLE_STATE_POLL_ATTEMPTS = 5;
const MERGEABLE_STATE_POLL_DELAY_MS = 500;

const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNABORTED",
]);

type PRGetResponse =
  Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}"]["response"]["data"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryablePullError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { status?: number; code?: string };
  if (typeof maybeError.status === "number") {
    return maybeError.status >= 500 && maybeError.status < 600;
  }

  if (typeof maybeError.code === "string") {
    return RETRYABLE_ERROR_CODES.has(maybeError.code);
  }

  return false;
}

export async function fetchPRWithMergeablePolling({
  octokit,
  owner,
  repo,
  prNumber,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
}): Promise<PRGetResponse> {
  let lastData: PRGetResponse | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MERGEABLE_STATE_POLL_ATTEMPTS; attempt += 1) {
    try {
      const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });
      lastData = data;
      lastError = null;

      const isComputingMergeableState =
        data.mergeable_state == null && data.mergeable == null;

      if (!isComputingMergeableState) {
        return data;
      }

      if (attempt < MERGEABLE_STATE_POLL_ATTEMPTS - 1) {
        await sleep(MERGEABLE_STATE_POLL_DELAY_MS);
      }
    } catch (error) {
      lastError = error as Error;
      // Only retry on network/transient errors, not on 404s or other API errors.
      if (!isRetryablePullError(error)) {
        throw error;
      }

      if (attempt < MERGEABLE_STATE_POLL_ATTEMPTS - 1) {
        await sleep(MERGEABLE_STATE_POLL_DELAY_MS);
      }
    }
  }

  if (lastData === null) {
    throw lastError ?? new Error("Failed to fetch PR data after all attempts");
  }

  return lastData;
}
