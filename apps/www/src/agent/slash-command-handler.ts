import { db } from "@/lib/db";
import {
  DBUserMessage,
  DBUserMessageWithModel,
  DBSystemMessage,
} from "@terragon/shared";
import { updateThreadChat, getThread } from "@terragon/shared/model/threads";
import { getPostHogServer } from "@/lib/posthog-server";
import {
  convertToPlainText,
  detectSkillInvocation,
  processSkillInMessage,
  extractUserMessageFromSkillInvocation,
} from "@/lib/db-message-helpers";
import { compactThreadChat } from "@/server-lib/compact";
import { updateThreadChatWithTransition } from "./update-status";
import { withThreadChat } from "./thread-resource";
import { ThreadError } from "./error";
import { getFeatureFlagForUser } from "@terragon/shared/model/feature-flags";
import { getSkillContentInternal } from "@/server-actions/github-skills";

export interface SlashCommandResult {
  handled: boolean;
  /** If skill was processed, the transformed message (preserves model from original) */
  transformedMessage?: DBUserMessageWithModel;
}

export function getSlashCommandOrNull(message: DBUserMessage): string | null {
  const messageText = convertToPlainText({ message }).trim();
  if (messageText === "/clear") {
    return "/clear";
  }
  if (messageText === "/compact") {
    return "/compact";
  }
  return null;
}

export async function handleSlashCommand({
  userId,
  threadId,
  threadChatId,
  message,
}: {
  userId: string;
  threadId: string;
  threadChatId: string;
  message: DBUserMessage;
}): Promise<SlashCommandResult> {
  const command = getSlashCommandOrNull(message);
  if (command === "/clear") {
    return await handleClearCommand({
      userId,
      threadId,
      threadChatId,
      message,
    });
  }
  if (command === "/compact") {
    return await handleCompactCommand({
      userId,
      threadId,
      threadChatId,
      message,
    });
  }

  // Check for skill invocation (e.g., /skill-name args)
  // Only process skills if the message has a model (DBUserMessageWithModel)
  if (message.model) {
    const skillResult = await handleSkillInvocation({
      userId,
      threadId,
      message: message as DBUserMessageWithModel,
    });
    if (skillResult.handled || skillResult.transformedMessage) {
      return skillResult;
    }
  }

  // Let /test-prompt-too-long pass through to the daemon for end-to-end testing
  // The daemon will handle it and send back a mock error response

  // No slash command detected
  return {
    handled: false,
  };
}

async function handleClearCommand({
  userId,
  threadId,
  threadChatId,
  message,
}: {
  userId: string;
  threadId: string;
  threadChatId: string;
  message: DBUserMessage;
}) {
  console.log("Processing /clear command");
  getPostHogServer().capture({
    distinctId: userId,
    event: "slash_command",
    properties: {
      threadId,
      threadChatId,
      command: "clear",
    },
  });
  const systemMessage: DBSystemMessage = {
    type: "system",
    message_type: "clear-context",
    parts: [],
    timestamp: new Date().toISOString(),
  };
  await updateThreadChatWithTransition({
    userId,
    threadId,
    threadChatId,
    eventType: "system.slash-command-done",
    chatUpdates: {
      appendMessages: [message, systemMessage],
      sessionId: null,
      errorMessage: null,
      errorMessageInfo: null,
      contextLength: null,
    },
  });
  return {
    handled: true,
  };
}

async function handleCompactCommand({
  userId,
  threadId,
  threadChatId,
  message,
}: {
  userId: string;
  threadId: string;
  threadChatId: string;
  message: DBUserMessage;
}) {
  console.log("Processing /compact command");
  getPostHogServer().capture({
    distinctId: userId,
    event: "slash_command",
    properties: {
      threadId,
      threadChatId,
      command: "compact",
    },
  });
  await updateThreadChat({
    db,
    userId,
    threadId,
    threadChatId,
    updates: {
      appendMessages: [message],
    },
  });
  await withThreadChat({
    threadId,
    threadChatId,
    userId,
    execOrThrow: async () => {
      const compactResult = await compactThreadChat({
        threadId,
        userId,
        threadChatId,
      });
      if (!compactResult) {
        throw new ThreadError(
          "unknown-error",
          "Failed to compact thread",
          null,
        );
      }
      const systemMessage: DBSystemMessage = {
        type: "system",
        message_type: "compact-result",
        parts: [{ type: "text", text: compactResult.summary }],
        timestamp: new Date().toISOString(),
      };
      await updateThreadChatWithTransition({
        userId,
        threadId,
        threadChatId,
        eventType: "system.slash-command-done",
        chatUpdates: {
          appendMessages: [systemMessage],
          sessionId: null,
          errorMessage: null,
          errorMessageInfo: null,
          contextLength: null,
        },
      });
    },
  });
  return {
    handled: true,
  };
}

/**
 * Handle skill invocation patterns like /skill-name args.
 * If a valid skill is found, transforms the message to include skill content.
 */
async function handleSkillInvocation({
  userId,
  threadId,
  message,
}: {
  userId: string;
  threadId: string;
  message: DBUserMessageWithModel;
}): Promise<SlashCommandResult> {
  // Check if skills feature is enabled
  const isSkillsEnabled = await getFeatureFlagForUser({
    db,
    userId,
    flagName: "claudeCodeSkillsIntegration",
  });
  if (!isSkillsEnabled) {
    return { handled: false };
  }

  // Get message text and check for skill invocation pattern
  const messageText = convertToPlainText({ message }).trim();
  const skillInvocation = detectSkillInvocation(messageText);
  if (!skillInvocation) {
    return { handled: false };
  }

  const { skillName, args } = skillInvocation;

  // Get thread info to access repo and branch
  const thread = await getThread({ db, threadId, userId });
  if (!thread?.githubRepoFullName || !thread?.branchName) {
    console.log("Skill invocation skipped: no repo/branch context");
    return { handled: false };
  }

  // Fetch skill content
  try {
    const skillContent = await getSkillContentInternal(
      userId,
      thread.githubRepoFullName,
      thread.branchName,
      skillName,
    );

    if (!skillContent) {
      // Skill not found - let it pass through as regular message
      console.log(
        `Skill "${skillName}" not found in ${thread.githubRepoFullName}`,
      );
      return { handled: false };
    }

    // Check if skill is user-invocable
    if (!skillContent.userInvocable) {
      console.log(`Skill "${skillName}" is not user-invocable`);
      return { handled: false };
    }

    getPostHogServer().capture({
      distinctId: userId,
      event: "skill_invoked",
      properties: {
        threadId,
        skillName,
        hasArgs: !!args,
        repoFullName: thread.githubRepoFullName,
      },
    });

    // Extract any additional user message after the skill invocation
    const userMessageAfterSkill =
      extractUserMessageFromSkillInvocation(messageText);

    // Process skill content with arguments and create transformed message
    const processedContent = processSkillInMessage({
      skillContent: skillContent.content,
      args,
      userMessage: userMessageAfterSkill,
    });

    // Preserve non-text parts (attachments like images, PDFs, text files) from original message
    const attachmentParts = message.parts.filter(
      (part) =>
        part.type === "image" ||
        part.type === "pdf" ||
        part.type === "text-file",
    );

    // Create transformed message with skill content prepended (preserves model and attachments)
    const transformedMessage: DBUserMessageWithModel = {
      ...message,
      parts: [
        {
          type: "text" as const,
          text: processedContent,
        },
        ...attachmentParts,
      ],
    };

    console.log(`Processed skill "${skillName}" for thread ${threadId}`);

    // Return transformed message - caller will continue with agent message
    return {
      handled: false, // Don't mark as fully handled - we want to continue to agent
      transformedMessage,
    };
  } catch (error) {
    console.error(`Error processing skill "${skillName}":`, error);
    // On error, let the original message pass through
    return { handled: false };
  }
}
