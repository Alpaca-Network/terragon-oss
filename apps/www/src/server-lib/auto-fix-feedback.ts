import { db } from "@/lib/db";
import { getOctokitForApp, parseRepoFullName } from "@/lib/github";
import {
  aggregatePRFeedback,
  createFeedbackSummary,
} from "@terragon/shared/github/pr-feedback";
import {
  getThreadChat,
  getThreadMinimal,
  updateThread,
} from "@terragon/shared/model/threads";
import { queueFollowUpInternal } from "./follow-up";
import { getPostHogServer } from "@/lib/posthog-server";
import type { DBUserMessage } from "@terragon/shared";
import { LEGACY_THREAD_CHAT_ID } from "@terragon/shared/utils/thread-utils";
import * as schema from "@terragon/shared/db/schema";
import { eq, desc, and } from "drizzle-orm";

const MAX_AUTO_FIX_ITERATIONS = 5;

/**
 * Checks if auto-fix should be triggered for a thread and queues a follow-up if needed.
 * This is called when new PR feedback is received (comments, reviews, check failures).
 */
export async function maybeQueueAutoFixFollowUp({
  threadId,
  userId,
  triggerSource,
}: {
  threadId: string;
  userId: string;
  triggerSource: "pr_comment" | "check_run" | "review";
}): Promise<{ queued: boolean; reason: string }> {
  // Get thread to check if auto-fix is enabled
  const thread = await getThreadMinimal({ db, threadId, userId });
  if (!thread) {
    return { queued: false, reason: "Thread not found" };
  }

  // Check if auto-fix is enabled for this thread
  if (!thread.autoFixFeedback) {
    return { queued: false, reason: "Auto-fix feedback is not enabled" };
  }

  // Check if thread has an associated PR
  if (!thread.githubPRNumber) {
    return { queued: false, reason: "Thread does not have an associated PR" };
  }

  // Check iteration count to prevent infinite loops
  const currentIterations = thread.autoFixIterationCount ?? 0;
  if (currentIterations >= MAX_AUTO_FIX_ITERATIONS) {
    console.log(
      `Auto-fix max iterations (${MAX_AUTO_FIX_ITERATIONS}) reached for thread ${threadId}`,
    );
    return {
      queued: false,
      reason: `Max auto-fix iterations (${MAX_AUTO_FIX_ITERATIONS}) reached`,
    };
  }

  // Get latest thread chat
  // For legacy threads (version 0), use LEGACY_THREAD_CHAT_ID
  // For newer threads (version 1+), query for the latest thread chat
  let threadChatId: string;
  if (thread.version === 0) {
    threadChatId = LEGACY_THREAD_CHAT_ID;
  } else {
    const latestThreadChat = await db
      .select({ id: schema.threadChat.id })
      .from(schema.threadChat)
      .where(
        and(
          eq(schema.threadChat.threadId, threadId),
          eq(schema.threadChat.userId, userId),
        ),
      )
      .orderBy(desc(schema.threadChat.createdAt))
      .limit(1);
    if (latestThreadChat.length === 0) {
      return { queued: false, reason: "Thread chat not found" };
    }
    threadChatId = latestThreadChat[0]!.id;
  }

  const threadChat = await getThreadChat({
    db,
    threadId,
    threadChatId,
    userId,
  });
  if (!threadChat) {
    return { queued: false, reason: "Thread chat not found" };
  }

  // Don't queue auto-fix if the agent is currently working
  const workingStatuses = ["queued", "booting", "working", "checkpointing"];
  if (workingStatuses.includes(threadChat.status)) {
    return {
      queued: false,
      reason: "Agent is currently working, will check again when done",
    };
  }

  // Don't queue if there's already a queued follow-up
  if (threadChat.queuedMessages && threadChat.queuedMessages.length > 0) {
    return { queued: false, reason: "Follow-up already queued" };
  }

  // Fetch current PR feedback
  const [owner, repo] = parseRepoFullName(thread.githubRepoFullName);
  const octokit = await getOctokitForApp({ owner, repo });
  const feedback = await aggregatePRFeedback(
    octokit,
    owner,
    repo,
    thread.githubPRNumber,
  );
  const summary = createFeedbackSummary(feedback);

  // Check if there's actionable feedback
  const hasUnresolvedComments = summary.unresolvedCommentCount > 0;
  const hasFailingChecks = summary.failingCheckCount > 0;

  if (!hasUnresolvedComments && !hasFailingChecks) {
    return { queued: false, reason: "No actionable feedback to address" };
  }

  // Build the auto-fix message
  const feedbackParts: string[] = [];

  if (hasUnresolvedComments) {
    feedbackParts.push(
      `${summary.unresolvedCommentCount} unresolved PR comment${summary.unresolvedCommentCount > 1 ? "s" : ""}`,
    );
  }

  if (hasFailingChecks) {
    feedbackParts.push(
      `${summary.failingCheckCount} failing check${summary.failingCheckCount > 1 ? "s" : ""}`,
    );
  }

  const feedbackDescription = feedbackParts.join(" and ");
  const iterationInfo =
    currentIterations > 0
      ? ` (auto-fix iteration ${currentIterations + 1}/${MAX_AUTO_FIX_ITERATIONS})`
      : "";

  const autoFixMessage: DBUserMessage = {
    type: "user",
    model: threadChat.lastUsedModel,
    parts: [
      {
        type: "text",
        text: `[Auto-fix${iterationInfo}] Please address the following PR feedback: ${feedbackDescription}. Review the feedback and make the necessary changes to resolve these issues.`,
      },
    ],
    timestamp: new Date().toISOString(),
    permissionMode: threadChat.permissionMode ?? undefined,
  };

  // Queue the follow-up
  await queueFollowUpInternal({
    userId,
    threadId,
    threadChatId: threadChat.id,
    messages: [autoFixMessage],
    appendOrReplace: "replace",
    source: "github",
  });

  // Increment iteration count and record queue timestamp
  // The timestamp is used to auto-resolve PR comments that existed before this queue time
  const queuedAt = new Date();
  await updateThread({
    db,
    userId,
    threadId,
    updates: {
      autoFixIterationCount: currentIterations + 1,
      autoFixQueuedAt: queuedAt,
    },
  });

  // Track the auto-fix queue event
  getPostHogServer().capture({
    distinctId: userId,
    event: "auto_fix_feedback_queued",
    properties: {
      threadId,
      triggerSource,
      unresolvedCommentCount: summary.unresolvedCommentCount,
      failingCheckCount: summary.failingCheckCount,
      iteration: currentIterations + 1,
    },
  });

  console.log(
    `Auto-fix follow-up queued for thread ${threadId}: ${feedbackDescription}`,
  );

  return {
    queued: true,
    reason: `Queued auto-fix for: ${feedbackDescription}`,
  };
}

/**
 * Resets the auto-fix iteration count for a thread.
 * This should be called when a user manually sends a message to the thread,
 * as it indicates they've taken over and the auto-fix cycle should reset.
 */
export async function resetAutoFixIterationCount({
  threadId,
  userId,
}: {
  threadId: string;
  userId: string;
}): Promise<void> {
  await updateThread({
    db,
    userId,
    threadId,
    updates: {
      autoFixIterationCount: 0,
    },
  });
}
