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
import { getSkillContentInternal } from "@/server-lib/github-skills";
import { getUserSkillContent } from "@/server-lib/user-skills";

// Built-in slash commands that are passed through to the agent (daemon)
// These are handled by Claude Code or other agents, not the server
const AGENT_HANDLED_COMMANDS = [
  "init",
  "pr-comments",
  "review",
  "test-prompt-too-long", // For end-to-end testing
];

/**
 * Extract slash command name from message text.
 * Returns the command name (without /) if the message starts with a slash command pattern,
 * or null if no slash command is detected.
 */
export function extractSlashCommandName(messageText: string): string | null {
  const trimmed = messageText.trim();
  // Match /command-name at the start (command names can contain letters, numbers, hyphens, underscores)
  const match = trimmed.match(/^\/([a-zA-Z0-9_-]+)/);
  return match ? match[1]! : null;
}

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

  // Check if message starts with a slash command pattern
  const messageText = convertToPlainText({ message }).trim();
  const commandName = extractSlashCommandName(messageText);

  // If it's a known agent-handled command, pass through to daemon immediately
  // This check must happen BEFORE skill checking to avoid blocking valid daemon commands
  if (commandName && AGENT_HANDLED_COMMANDS.includes(commandName)) {
    return { handled: false };
  }

  // Check for skill invocation (e.g., /skill-name args)
  // Only process skills if the message has a model (DBUserMessageWithModel)
  if (message.model) {
    const skillResult = await handleSkillInvocation({
      userId,
      threadId,
      threadChatId,
      message: message as DBUserMessageWithModel,
    });
    if (skillResult.handled || skillResult.transformedMessage) {
      return skillResult;
    }
  }

  // At this point, if message starts with a slash command that:
  // - Is not a server-handled command (/clear, /compact)
  // - Is not a known agent-handled command (/init, /pr-comments, /review)
  // - Is not a valid skill in the repository
  // Then it's an unknown command - log it and pass through to agent
  // This allows patterns like "/audit" or URL-like references to work as keywords
  if (commandName) {
    logUnknownSlashCommand({
      userId,
      threadId,
      threadChatId,
      commandName,
    });
  }

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

function logUnknownSlashCommand({
  userId,
  threadId,
  threadChatId,
  commandName,
}: {
  userId: string;
  threadId: string;
  threadChatId: string;
  commandName: string;
}): void {
  // Log for analytics purposes, but don't block the message
  // Unknown slash commands are passed through to the agent as regular messages
  // This allows patterns like "/audit" or "/inbox" to be treated as keywords
  console.log(
    `Unknown slash command /${commandName} - passing through to agent`,
  );
  getPostHogServer().capture({
    distinctId: userId,
    event: "slash_command_unknown",
    properties: {
      threadId,
      threadChatId,
      command: commandName,
    },
  });
}

/**
 * Handle skill invocation patterns like /skill-name args.
 * If a valid skill is found, transforms the message to include skill content.
 */
async function handleSkillInvocation({
  userId,
  threadId,
  threadChatId,
  message,
}: {
  userId: string;
  threadId: string;
  threadChatId: string;
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
  // Skip attachments to prevent them from polluting skill detection
  const messageText = convertToPlainText({
    message,
    skipAttachments: true,
  }).trim();
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

  // Fetch skill content - check user-configured skills first, then fall back to GitHub
  try {
    // First, check user-configured skills (global + repo-specific)
    let skillContent = await getUserSkillContent({
      userId,
      repoFullName: thread.githubRepoFullName,
      skillName,
    });

    // Fall back to GitHub-based skills if not found in user config
    if (!skillContent) {
      skillContent = await getSkillContentInternal(
        userId,
        thread.githubRepoFullName,
        thread.branchName,
        skillName,
      );
    }

    if (!skillContent) {
      // Skill not found - let it pass through as regular message
      console.log(
        `Skill "${skillName}" not found in user config or ${thread.githubRepoFullName}`,
      );
      return { handled: false };
    }

    // Check if skill is user-invocable (already checked in getUserSkillContent, but double-check for GitHub skills)
    if (!skillContent.userInvocable) {
      console.log(`Skill "${skillName}" is not user-invocable`);
      return { handled: false };
    }

    // Determine skill source for analytics
    const skillSource = skillContent.filePath.startsWith("[user-configured:")
      ? "user-configured"
      : "github";

    getPostHogServer().capture({
      distinctId: userId,
      event: "skill_invoked",
      properties: {
        threadId,
        skillName,
        hasArgs: !!args,
        repoFullName: thread.githubRepoFullName,
        skillSource,
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
