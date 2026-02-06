import { db } from "@/lib/db";
import { getOctokitForApp, parseRepoFullName } from "@/lib/github";
import { resolveThreadsCreatedBefore } from "@terragon/shared/github/pr-feedback";
import { getThreadMinimal, updateThread } from "@terragon/shared/model/threads";
import { getPostHogServer } from "@/lib/posthog-server";

/**
 * Auto-resolves PR review comments that were created before the auto-fix was queued.
 *
 * This function is called after the agent completes a task. If:
 * 1. The thread has auto-fix enabled
 * 2. The thread has an associated PR
 * 3. The thread has a recorded auto-fix queue timestamp
 *
 * Then we resolve all unresolved PR review threads whose first comment was
 * created before that timestamp. This assumes the agent addressed those comments
 * since the auto-fix was triggered because of them.
 *
 * After resolving, we clear the autoFixQueuedAt timestamp so we don't re-resolve
 * the same comments on subsequent task completions.
 */
export async function maybeAutoResolvePRComments({
  userId,
  threadId,
}: {
  userId: string;
  threadId: string;
}): Promise<{ resolved: number; failed: number; skipped: number } | null> {
  try {
    const thread = await getThreadMinimal({ db, threadId, userId });
    if (!thread) {
      return null;
    }

    // Check prerequisites
    if (!thread.autoFixFeedback) {
      return null;
    }

    if (!thread.githubPRNumber || !thread.githubRepoFullName) {
      return null;
    }

    if (!thread.autoFixQueuedAt) {
      return null;
    }

    const [owner, repo] = parseRepoFullName(thread.githubRepoFullName);
    const octokit = await getOctokitForApp({ owner, repo });

    // Resolve threads created before the auto-fix was queued
    const result = await resolveThreadsCreatedBefore(
      octokit,
      owner,
      repo,
      thread.githubPRNumber,
      thread.autoFixQueuedAt.toISOString(),
    );

    // Clear the autoFixQueuedAt timestamp after processing
    // This ensures we don't re-resolve the same comments on subsequent completions
    await updateThread({
      db,
      userId,
      threadId,
      updates: {
        autoFixQueuedAt: null,
      },
    });

    // Track the auto-resolve event
    if (result.resolved > 0 || result.failed > 0) {
      getPostHogServer().capture({
        distinctId: userId,
        event: "auto_resolve_pr_comments",
        properties: {
          threadId,
          prNumber: thread.githubPRNumber,
          resolved: result.resolved,
          failed: result.failed,
          skipped: result.skipped,
        },
      });

      console.log(
        `Auto-resolved PR comments for thread ${threadId}: ${result.resolved} resolved, ${result.failed} failed, ${result.skipped} skipped (newer than queue time)`,
      );
    }

    return result;
  } catch (error) {
    console.error("Error in auto-resolve PR comments:", error);
    // Don't throw - we don't want to fail the checkpoint if auto-resolve fails
    return null;
  }
}
