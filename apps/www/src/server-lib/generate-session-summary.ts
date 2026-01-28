import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import * as z from "zod/v4";

const compactSchema = z.object({
  summary: z.string().describe("Abridged summary of the session log"),
});

export async function generateSessionSummary({
  sessionHistory,
  nextTask,
}: {
  sessionHistory: string;
  nextTask?: string;
}): Promise<string> {
  const promptParts = [
    "Based on the following session history, generate an abridged summary that captures the key activities, changes made, and outcomes:",
    "",
    "<session-history>",
    sessionHistory,
    "</session-history>",
    "",
    ...(nextTask
      ? [
          "The summary will be used as context for the following task:",
          "",
          "<next-task>",
          nextTask,
          "</next-task>",
          "",
          "Pay special attention to information that would be relevant for completing this task.",
          "",
        ]
      : []),
    "Generate an extremely detailed summary that includes:",
    "- Main tasks or objectives worked on",
    "- Key files created, modified, or deleted",
    "- Important commands run or tools used",
    "- Major outcomes or results",
    "- Any errors or issues encountered and their resolutions",
    "- The contents of major conclusions you came to.",
    ...(nextTask
      ? ["- Any information relevant to the next task described above"]
      : []),
  ];
  try {
    const result = await generateObject({
      model: openai("gpt-4.1-mini"),
      schema: compactSchema,
      maxOutputTokens: 32768,
      prompt: promptParts.join("\n"),
    });
    console.log("[ai/generateObject] response_id:", result.response?.id);
    return (result.object as z.infer<typeof compactSchema>).summary;
  } catch (error) {
    // Check for quota/billing errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("quota") ||
      errorMessage.includes("insufficient_quota") ||
      errorMessage.includes("billing")
    ) {
      console.error(
        "OpenAI quota exceeded for session summary generation. Please check OpenAI billing.",
        error,
      );
    } else {
      console.error("Failed to generate session summary:", error);
    }
    throw error;
  }
}
