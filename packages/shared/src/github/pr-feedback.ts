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
export async function fetchPRDetails(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PRGetResponse> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return data;
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
 * Uses GitHub's review thread API when available, falls back to comment grouping
 */
function groupCommentsIntoThreads(comments: ReviewCommentsResponse): {
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

  // Convert map to threads array
  // For now, treat all threads as unresolved since GitHub REST API
  // doesn't directly expose resolved status. The GraphQL API does,
  // but we'll use a heuristic: threads with no replies in 24h are considered "addressed"
  const unresolved: PRReviewThread[] = [];
  const resolved: PRReviewThread[] = [];

  for (const [threadId, threadComments] of threadMap) {
    // Sort comments by creation date
    threadComments.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const thread: PRReviewThread = {
      id: String(threadId),
      isResolved: false, // Default to unresolved - can be enhanced with GraphQL later
      comments: threadComments,
    };

    // Heuristic: if the last comment is from the PR author and mentions "done", "fixed", "addressed",
    // consider it potentially resolved (user can expand to see full context)
    const lastComment = threadComments[threadComments.length - 1];
    const resolvedKeywords =
      /\b(done|fixed|addressed|resolved|updated|applied)\b/i;
    if (lastComment && resolvedKeywords.test(lastComment.body)) {
      thread.isResolved = true;
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
  // Fetch all data in parallel
  const [prDetails, rawComments, rawChecks] = await Promise.all([
    fetchPRDetails(octokit, owner, repo, prNumber),
    fetchPRComments(octokit, owner, repo, prNumber),
    fetchPRDetails(octokit, owner, repo, prNumber).then((pr) =>
      fetchPRChecks(octokit, owner, repo, pr.head.sha),
    ),
  ]);

  const comments = groupCommentsIntoThreads(rawComments);
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
