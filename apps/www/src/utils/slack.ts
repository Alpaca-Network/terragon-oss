import { env } from "@terragon/env/apps-www";
import type { FeedbackType } from "@terragon/shared";

// Slack Block Kit types for type safety
type SlackTextObject = {
  type: "plain_text" | "mrkdwn";
  text: string;
  emoji?: boolean;
};

type SlackHeaderBlock = {
  type: "header";
  text: SlackTextObject;
};

type SlackSectionBlock = {
  type: "section";
  text?: SlackTextObject;
  fields?: SlackTextObject[];
};

type SlackContextBlock = {
  type: "context";
  elements: SlackTextObject[];
};

type SlackBlock = SlackHeaderBlock | SlackSectionBlock | SlackContextBlock;

interface SlackFeedbackMessage {
  userId: string;
  userEmail?: string;
  userName?: string;
  type: FeedbackType;
  message: string;
  currentPage: string;
  feedbackId: string;
  sessionReplayUrl?: string | null;
}

export async function sendFeedbackToSlack({
  userId,
  userEmail,
  userName,
  type,
  message,
  currentPage,
  feedbackId,
  sessionReplayUrl,
}: SlackFeedbackMessage): Promise<void> {
  const webhookUrl = env.SLACK_FEEDBACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log("Slack webhook URL not configured, skipping notification");
    return;
  }

  const typeEmoji = {
    bug: "🐛",
    feature: "💡",
    feedback: "💬",
  };

  const typeColor = {
    bug: "#E74C3C",
    feature: "#3498DB",
    feedback: "#2ECC71",
  };

  // Build blocks array with conditional session replay section
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${typeEmoji[type]} New ${type.charAt(0).toUpperCase() + type.slice(1)} Submitted`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*User:*\n${userName || "Unknown"} (${userEmail || userId})`,
        },
        {
          type: "mrkdwn",
          text: `*Page:*\n${currentPage}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Message:*\n${message}`,
      },
    },
  ];

  // Add session replay link if available
  if (sessionReplayUrl) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Session Replay:*\n<${sessionReplayUrl}|View Recording>`,
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Feedback ID: ${feedbackId} | Submitted at <!date^${Math.floor(Date.now() / 1000)}^{date_pretty} at {time}|${new Date().toISOString()}>`,
      },
    ],
  });

  const slackMessage = {
    blocks,
    attachments: [
      {
        color: typeColor[type],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to send feedback to Slack:", error);
  }
}
