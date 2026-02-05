import { Octokit } from "octokit";
import type { Endpoints } from "@octokit/types";
import type {
  PRComment,
  PRReviewThread,
  PRCheckRun,
  PRFeedback,
  PRFeedbackSummary,
  PRHeader,
  PRCommentsData,
  PRChecksData,
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
      createdAt: string;
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

// Extended type for threads that can be resolved
export type ResolvableReviewThread = {
  graphqlId: string;
  databaseId: number;
  isResolved: boolean;
  isOutdated: boolean;
  createdAt: string;
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
                createdAt
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

// GraphQL mutation to resolve a review thread
const RESOLVE_REVIEW_THREAD_MUTATION = `
  mutation ResolveReviewThread($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
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

function isRetryableGithubError(error: unknown) {
  const status = (error as { status?: number }).status;
  if (status === 401 || status === 403 || status === 404 || status === 422) {
    return false;
  }
  return true;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchPRDetails(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  options?: { skipMergeablePolling?: boolean },
): Promise<PRGetResponse> {
  const skipPolling = options?.skipMergeablePolling ?? false;
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

      // Skip polling if requested - return immediately after first fetch
      if (skipPolling) {
        return data;
      }

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
      if (!isRetryableGithubError(error)) {
        throw error;
      }
      if (attempt < MERGEABLE_STATE_POLL_ATTEMPTS - 1) {
        await sleep(MERGEABLE_STATE_POLL_DELAY_MS);
      }
    }
  }

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
    }

    // Check for bot-specific "addressed" markers in comment bodies.
    // Bots like CodeRabbit edit their original comment to add "✅ Addressed in commit X"
    // when issues are fixed. This marker is authoritative for bot comments and should
    // override GraphQL status, as GitHub's API doesn't always track bot-edited comments.
    // We intentionally check this even if GraphQL returned isResolved:false, because
    // the bot's explicit marker is more reliable for bot-generated review comments.
    const botAddressedPattern = /✅\s*Addressed\s*(in\s+commit)?/i;
    for (const comment of threadComments) {
      if (botAddressedPattern.test(comment.body)) {
        isResolved = true;
        break;
      }
    }

    // Final fallback (only when not resolved by GraphQL or bot markers):
    // Check if the last comment mentions resolution keywords from a human reply
    if (!isResolved) {
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
  // Skip mergeable state polling - the UI handles refetching when state is unknown
  const prDetails = await fetchPRDetails(octokit, owner, repo, prNumber, {
    skipMergeablePolling: true,
  });

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

  // Determine if PR is mergeable. We explicitly exclude "unstable" state (failing checks)
  // even though GitHub may still allow merging with non-required check failures.
  // This ensures UI consistency - we don't show "Ready to merge" alongside "Failing checks".
  const isMergeable =
    !hasConflicts &&
    mergeableState !== "blocked" &&
    mergeableState !== "unstable" &&
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
    isAutoMergeEnabled: prDetails.auto_merge !== null,
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

/**
 * Fetches all unresolved review threads with their GraphQL IDs (needed for resolution).
 * Returns threads that can be resolved programmatically.
 */
export async function fetchUnresolvedReviewThreads(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ResolvableReviewThread[]> {
  const threads: ResolvableReviewThread[] = [];

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
      const nodes = reviewThreads?.nodes || [];

      for (const thread of nodes) {
        // Only include unresolved threads that aren't outdated
        if (!thread.isResolved && !thread.isOutdated) {
          const firstComment = thread.comments.nodes[0];
          if (firstComment?.databaseId && firstComment?.createdAt) {
            threads.push({
              graphqlId: thread.id,
              databaseId: firstComment.databaseId,
              isResolved: thread.isResolved,
              isOutdated: thread.isOutdated,
              createdAt: firstComment.createdAt,
            });
          }
        }
      }

      hasNextPage = reviewThreads?.pageInfo?.hasNextPage || false;
      cursor = reviewThreads?.pageInfo?.endCursor || null;
    } catch (error) {
      console.warn(
        "Failed to fetch unresolved review threads via GraphQL:",
        error,
      );
      break;
    }
  }

  return threads;
}

/**
 * Resolves a single review thread using its GraphQL ID.
 * Returns true if successfully resolved, false otherwise.
 */
export async function resolveReviewThread(
  octokit: Octokit,
  threadId: string,
): Promise<boolean> {
  try {
    await octokit.graphql(RESOLVE_REVIEW_THREAD_MUTATION, {
      threadId,
    });
    return true;
  } catch (error) {
    console.warn(`Failed to resolve review thread ${threadId}:`, error);
    return false;
  }
}

/**
 * Resolves all unresolved review threads that were created before a given timestamp.
 * This is useful for auto-resolving comments after the agent has addressed them.
 *
 * @param octokit - GitHub Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param beforeTimestamp - ISO timestamp; threads created before this will be resolved
 * @returns Object with counts of resolved and failed threads
 */
export async function resolveThreadsCreatedBefore(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  beforeTimestamp: string,
): Promise<{ resolved: number; failed: number; skipped: number }> {
  const threads = await fetchUnresolvedReviewThreads(
    octokit,
    owner,
    repo,
    prNumber,
  );

  const beforeDate = new Date(beforeTimestamp);

  // Separate threads into those to resolve and those to skip
  const threadsToResolve: ResolvableReviewThread[] = [];
  let skipped = 0;

  for (const thread of threads) {
    const threadDate = new Date(thread.createdAt);
    if (threadDate < beforeDate) {
      threadsToResolve.push(thread);
    } else {
      skipped++;
    }
  }

  // Resolve threads in parallel for better performance
  const results = await Promise.allSettled(
    threadsToResolve.map((thread) =>
      resolveReviewThread(octokit, thread.graphqlId),
    ),
  );

  let resolved = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === "fulfilled" && result.value === true) {
      resolved++;
    } else {
      failed++;
    }
  }

  return { resolved, failed, skipped };
}

// =============================================================================
// Split Aggregation Functions (for progressive loading)
// =============================================================================

/**
 * Fetches lightweight PR header data for fast initial render.
 * This is the first query to run - provides enough data to render the header
 * and determine if other queries should be enabled.
 */
export async function aggregatePRHeader(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PRHeader> {
  // Skip mergeable state polling for speed - UI handles refetching when state is unknown
  const prDetails = await fetchPRDetails(octokit, owner, repo, prNumber, {
    skipMergeablePolling: true,
  });

  const mergeableState = getGithubPRMergeableState(prDetails);
  const hasConflicts = mergeableState === "dirty";

  const isMergeable =
    !hasConflicts &&
    mergeableState !== "blocked" &&
    mergeableState !== "unstable" &&
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
    mergeableState,
    hasConflicts,
    isMergeable,
    isAutoMergeEnabled: prDetails.auto_merge !== null,
  };
}

/**
 * Fetches PR comments with resolution status.
 * Can run in parallel with checks fetch after header is loaded.
 */
export async function aggregatePRComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PRCommentsData> {
  // Fetch comments and resolution status in parallel
  const [rawComments, resolutionStatus] = await Promise.all([
    fetchPRComments(octokit, owner, repo, prNumber),
    fetchReviewThreadsResolutionStatus(octokit, owner, repo, prNumber),
  ]);

  const comments = groupCommentsIntoThreads(rawComments, resolutionStatus);

  const unresolvedCount = comments.unresolved.reduce(
    (acc, thread) => acc + thread.comments.length,
    0,
  );
  const resolvedCount = comments.resolved.reduce(
    (acc, thread) => acc + thread.comments.length,
    0,
  );

  return {
    comments,
    summary: {
      unresolvedCount,
      resolvedCount,
    },
  };
}

/**
 * Fetches PR check runs and coverage check.
 * Requires headSha from header data.
 */
export async function aggregatePRChecks(
  octokit: Octokit,
  owner: string,
  repo: string,
  headSha: string,
): Promise<PRChecksData> {
  const rawChecks = await fetchPRChecks(octokit, owner, repo, headSha);
  const checks = rawChecks.check_runs.map(toCheckRun);
  const coverageCheck = extractCoverageCheck(checks);

  const failingCount = checks.filter(
    (c) =>
      c.conclusion === "failure" ||
      c.conclusion === "timed_out" ||
      c.conclusion === "cancelled",
  ).length;

  const pendingCount = checks.filter(
    (c) => c.status === "queued" || c.status === "in_progress",
  ).length;

  const passingCount = checks.filter(
    (c) =>
      c.conclusion === "success" ||
      c.conclusion === "neutral" ||
      c.conclusion === "skipped",
  ).length;

  const hasCoverageCheck = coverageCheck !== null;
  const coverageCheckPassed = coverageCheck
    ? coverageCheck.conclusion === "success"
    : null;

  return {
    checks,
    coverageCheck,
    summary: {
      failingCount,
      pendingCount,
      passingCount,
      hasCoverageCheck,
      coverageCheckPassed,
    },
  };
}
