import { Octokit } from "octokit";
import type { Endpoints } from "@octokit/types";
import type {
  PRComment,
  PRReviewThread,
  PRCheckRun,
  PRFeedback,
  PRFeedbackSummary,
  GithubCheckRunStatus,
  GithubCheckRunConclusion,
} from "../db/types";
import {
  getGithubPRStatus,
  getGithubPRMergeableState,
} from "../github-api/helpers";

type PRGetResponse =
  Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}"]["response"]["data"];
type ReviewCommentsResponse =
  Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}/comments"]["response"]["data"];
type ReviewThreadsResponse =
  Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews"]["response"]["data"];
type CheckRunsResponse =
  Endpoints["GET /repos/{owner}/{repo}/commits/{ref}/check-runs"]["response"]["data"];

// GraphQL types for review thread resolution status
type GraphQLReviewThread = {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  comments: {
    nodes: Array<{
      databaseId: number;
    }>;
  };
};

type GraphQLReviewThreadsResponse = {
  repository: {
    pullRequest: {
      reviewThreads: {
        nodes: GraphQLReviewThread[];
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
    };
  };
};

// GraphQL query to fetch review thread resolution status
const REVIEW_THREADS_QUERY = `
  query GetReviewThreads($owner: String!, $repo: String!, $prNumber: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        reviewThreads(first: 100, after: $cursor) {
          nodes {
            id
            isResolved
            isOutdated
            comments(first: 1) {
              nodes {
                databaseId
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

/**
 * Fetches review thread resolution status using GitHub GraphQL API
 * Returns a map of comment ID to resolution status
 */
export async function fetchReviewThreadsResolutionStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<Map<number, { isResolved: boolean; isOutdated: boolean }>> {
  const resolutionMap = new Map<
    number,
    { isResolved: boolean; isOutdated: boolean }
  >();

  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    try {
      const response: GraphQLReviewThreadsResponse =
        await octokit.graphql<GraphQLReviewThreadsResponse>(
          REVIEW_THREADS_QUERY,
          {
            owner,
            repo,
            prNumber,
            cursor,
          },
        );

      const reviewThreads = response.repository.pullRequest?.reviewThreads;
      const threads = reviewThreads?.nodes || [];

      for (const thread of threads) {
        // Map the first comment's database ID to the thread's resolution status
        const firstComment = thread.comments.nodes[0];
        if (firstComment?.databaseId) {
          resolutionMap.set(firstComment.databaseId, {
            isResolved: thread.isResolved,
            isOutdated: thread.isOutdated,
          });
        }
      }

      hasNextPage = reviewThreads?.pageInfo?.hasNextPage || false;
      cursor = reviewThreads?.pageInfo?.endCursor || null;
    } catch (error) {
      // If GraphQL fails (permissions, etc), fall back to heuristic method
      console.warn(
        "Failed to fetch review thread resolution status via GraphQL, falling back to heuristics:",
        error,
      );
      break;
    }
  }

  return resolutionMap;
}

/**
 * Fetches PR review comments
 */
export async function fetchPRComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReviewCommentsResponse> {
  const { data } = await octokit.rest.pulls.listReviewComments({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return data;
}

/**
 * Fetches PR reviews (for resolved/unresolved thread tracking)
 */
export async function fetchPRReviews(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReviewThreadsResponse> {
  const { data } = await octokit.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return data;
}

/**
 * Fetches PR details including mergeable state
 */
const MERGEABLE_STATE_POLL_ATTEMPTS = 5;
const MERGEABLE_STATE_POLL_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
+ * Checks if an error is a network error that should be retried
+ */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors typically have these characteristics
    const message = error.message.toLowerCase();
    if (
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("socket") ||
      message.includes("dns")
    ) {
      return true;
    }
  }
  // Check for HTTP status codes - only retry on 5xx server errors
  const status = (error as { status?: number })?.status;
  if (status !== undefined && status >= 500) {
    return true;
  }
  // Don't retry on 4xx client errors (404, 403, 401, etc.)
  return false;
}

export async function fetchPRDetails(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PRGetResponse> {
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
      // Only retry on network errors or 5xx server errors, not on 4xx client errors
      if (
        !isRetryableError(error) ||
        attempt >= MERGEABLE_STATE_POLL_ATTEMPTS - 1
      ) {
        throw lastError;
      }
      await sleep(MERGEABLE_STATE_POLL_DELAY_MS);
    }
  }

  // If we get here, we have lastData but it's still in computing state
  // Return it anyway as the caller should handle the computing state
  if (lastData === null) {
    throw (
      lastError ?? new Error("Failed to fetch PR details after all attempts")
    );
  }

  return lastData;
}

/**
 * Fetches check runs for a commit
 */
export async function fetchPRChecks(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
): Promise<CheckRunsResponse> {
  const { data } = await octokit.rest.checks.listForRef({
    owner,
    repo,
    ref,
    per_page: 100,
  });
  return data;
}

/**
 * Converts raw GitHub comment to our PRComment type
 */
function toComment(raw: ReviewCommentsResponse[number]): PRComment {
  return {
    id: raw.id,
    body: raw.body,
    path: raw.path,
    line: raw.line ?? null,
    originalLine: raw.original_line ?? null,
    side: raw.side === "LEFT" ? "LEFT" : "RIGHT",
    author: {
      login: raw.user?.login ?? "unknown",
      avatarUrl: raw.user?.avatar_url ?? "",
    },
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    inReplyToId: raw.in_reply_to_id ?? undefined,
    htmlUrl: raw.html_url,
  };
}

/**
 * Converts raw GitHub check run to our PRCheckRun type
 */
function toCheckRun(raw: CheckRunsResponse["check_runs"][number]): PRCheckRun {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status as GithubCheckRunStatus,
    conclusion: raw.conclusion as GithubCheckRunConclusion | null,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    detailsUrl: raw.details_url,
    output: raw.output
      ? {
          title: raw.output.title ?? null,
          summary: raw.output.summary ?? null,
        }
      : undefined,
  };
}

/**
 * Groups comments into threads and determines resolved status
 * Uses GitHub's GraphQL API resolution status when available, falls back to heuristics
 */
function groupCommentsIntoThreads(
  comments: ReviewCommentsResponse,
  resolutionStatus?: Map<number, { isResolved: boolean; isOutdated: boolean }>,
): {
  unresolved: PRReviewThread[];
  resolved: PRReviewThread[];
} {
  // Group comments by their thread (using in_reply_to_id to link them)
  const threadMap = new Map<number, PRComment[]>();

  for (const comment of comments) {
    const converted = toComment(comment);
    const threadId = comment.in_reply_to_id ?? comment.id;

    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, []);
    }
    threadMap.get(threadId)!.push(converted);
  }

  const unresolved: PRReviewThread[] = [];
  const resolved: PRReviewThread[] = [];

  for (const [threadId, threadComments] of threadMap) {
    // Sort comments by creation date
    threadComments.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    // Check if we have GraphQL resolution status for this thread
    const graphqlStatus = resolutionStatus?.get(threadId);
    let isResolved = false;

    if (graphqlStatus !== undefined) {
      // Use actual GitHub resolution status from GraphQL
      // Treat outdated comments (where code has changed) as resolved since
      // they no longer apply to the current code
      isResolved = graphqlStatus.isResolved || graphqlStatus.isOutdated;
    } else {
      // Fall back to heuristic: if the last comment mentions resolution keywords
      const lastComment = threadComments[threadComments.length - 1];
      const resolvedKeywords =
        /\b(done|fixed|addressed|resolved|updated|applied)\b/i;
      if (lastComment && resolvedKeywords.test(lastComment.body)) {
        isResolved = true;
      }
    }

    const thread: PRReviewThread = {
      id: String(threadId),
      isResolved,
      comments: threadComments,
    };

    if (isResolved) {
      resolved.push(thread);
    } else {
      unresolved.push(thread);
    }
  }

  return { unresolved, resolved };
}

/**
 * Extracts coverage-related check from the list of checks
 * Looks for common coverage tool patterns
 */
export function extractCoverageCheck(checks: PRCheckRun[]): PRCheckRun | null {
  const coveragePatterns = [
    /codecov/i,
    /coverage/i,
    /coveralls/i,
    /code.?coverage/i,
    /jest.*coverage/i,
    /nyc/i,
    /istanbul/i,
  ];

  return (
    checks.find((check) =>
      coveragePatterns.some((pattern) => pattern.test(check.name)),
    ) ?? null
  );
}

/**
 * Aggregates all PR feedback into a single object
 */
export async function aggregatePRFeedback(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PRFeedback> {
  // Fetch PR details first to get head SHA
  const prDetails = await fetchPRDetails(octokit, owner, repo, prNumber);

  // Fetch remaining data in parallel
  const [rawComments, rawChecks, resolutionStatus] = await Promise.all([
    fetchPRComments(octokit, owner, repo, prNumber),
    fetchPRChecks(octokit, owner, repo, prDetails.head.sha),
    // Fetch actual resolution status from GraphQL API
    fetchReviewThreadsResolutionStatus(octokit, owner, repo, prNumber),
  ]);

  // Pass resolution status to thread grouping for accurate resolved/unresolved classification
  const comments = groupCommentsIntoThreads(rawComments, resolutionStatus);
  const checks = rawChecks.check_runs.map(toCheckRun);
  const coverageCheck = extractCoverageCheck(checks);

  const mergeableState = getGithubPRMergeableState(prDetails);
  const hasConflicts = mergeableState === "dirty";

  // Determine if PR is mergeable (GitHub's mergeable field handles check status)
  const isMergeable =
    !hasConflicts &&
    mergeableState !== "blocked" &&
    prDetails.mergeable === true;

  return {
    prNumber,
    repoFullName: `${owner}/${repo}`,
    prUrl: prDetails.html_url,
    prTitle: prDetails.title,
    prState: getGithubPRStatus(prDetails),
    baseBranch: prDetails.base.ref,
    headBranch: prDetails.head.ref,
    headSha: prDetails.head.sha,
    comments,
    checks,
    coverageCheck,
    mergeableState,
    hasConflicts,
    isMergeable,
  };
}

/**
 * Creates a summary of PR feedback for display in task lists
 */
export function createFeedbackSummary(feedback: PRFeedback): PRFeedbackSummary {
  const unresolvedCommentCount = feedback.comments.unresolved.reduce(
    (acc, thread) => acc + thread.comments.length,
    0,
  );
  const resolvedCommentCount = feedback.comments.resolved.reduce(
    (acc, thread) => acc + thread.comments.length,
    0,
  );

  const failingCheckCount = feedback.checks.filter(
    (c) =>
      c.conclusion === "failure" ||
      c.conclusion === "timed_out" ||
      c.conclusion === "cancelled",
  ).length;

  const pendingCheckCount = feedback.checks.filter(
    (c) => c.status === "queued" || c.status === "in_progress",
  ).length;

  const passingCheckCount = feedback.checks.filter(
    (c) =>
      c.conclusion === "success" ||
      c.conclusion === "neutral" ||
      c.conclusion === "skipped",
  ).length;

  const hasCoverageCheck = feedback.coverageCheck !== null;
  const coverageCheckPassed = feedback.coverageCheck
    ? feedback.coverageCheck.conclusion === "success"
    : null;

  return {
    unresolvedCommentCount,
    resolvedCommentCount,
    failingCheckCount,
    pendingCheckCount,
    passingCheckCount,
    hasCoverageCheck,
    coverageCheckPassed,
    hasConflicts: feedback.hasConflicts,
    isMergeable: feedback.isMergeable,
  };
}

/**
 * Available coverage integration options to suggest to users
 */
export const COVERAGE_INTEGRATION_OPTIONS = [
  {
    name: "Codecov",
    url: "https://codecov.io",
    description: "Popular code coverage tool with GitHub integration",
  },
  {
    name: "Coveralls",
    url: "https://coveralls.io",
    description: "Code coverage history and statistics",
  },
  {
    name: "Code Climate",
    url: "https://codeclimate.com",
    description: "Automated code review and coverage tracking",
  },
  {
    name: "SonarCloud",
    url: "https://sonarcloud.io",
    description: "Code quality and security with coverage",
  },
] as const;
