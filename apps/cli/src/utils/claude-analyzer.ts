/**
 * Claude API integration for local insights analysis
 * Requires ANTHROPIC_API_KEY environment variable
 */

interface FacetExtractionResult {
  goal: string;
  outcome: "success" | "partial" | "failure" | "unknown";
  satisfaction:
    | "frustrated"
    | "dissatisfied"
    | "likely_satisfied"
    | "satisfied"
    | "happy"
    | "unsure";
  friction: string[];
  summary: string;
}

const FACET_EXTRACTION_PROMPT = `You are analyzing a Claude Code session transcript. Extract the following information:

1. **Goal**: What task was the user trying to accomplish? Focus on explicitly requested tasks, NOT autonomous exploration.
2. **Outcome**: Did the task succeed (success), partially succeed (partial), fail (failure), or is it unclear (unknown)?
3. **Satisfaction**: Based on the conversation, estimate user satisfaction: frustrated, dissatisfied, likely_satisfied, satisfied, happy, or unsure.
4. **Friction**: List any friction points encountered (e.g., "misunderstood request", "wrong approach", "buggy code", "tool failure", "excessive changes").
5. **Summary**: A 1-2 sentence summary of what happened.

DO NOT count Claude's autonomous codebase exploration as part of the user's goal.

Respond in JSON format:
{
  "goal": "...",
  "outcome": "success|partial|failure|unknown",
  "satisfaction": "frustrated|dissatisfied|likely_satisfied|satisfied|happy|unsure",
  "friction": ["...", "..."],
  "summary": "..."
}`;

export async function extractSessionFacets(
  transcript: string,
  sessionId: string,
): Promise<FacetExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Fallback to basic analysis without Claude API
    return {
      goal: "Unknown (ANTHROPIC_API_KEY not set)",
      outcome: "unknown",
      satisfaction: "unsure",
      friction: [],
      summary:
        "Analysis skipped - ANTHROPIC_API_KEY environment variable not set",
    };
  }

  try {
    // Chunk transcript if too long (max ~25k chars per Claude's docs)
    const maxChunkSize = 25000;
    let analyzedTranscript = transcript;

    if (transcript.length > maxChunkSize) {
      // Take first and last portions for context
      const firstPart = transcript.slice(0, maxChunkSize / 2);
      const lastPart = transcript.slice(-maxChunkSize / 2);
      analyzedTranscript = `${firstPart}\n\n[...middle content omitted...]\n\n${lastPart}`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251204",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `${FACET_EXTRACTION_PROMPT}\n\nSession transcript:\n${analyzedTranscript}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error("No content in Claude response");
    }

    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      goal: parsed.goal || "Unknown",
      outcome: parsed.outcome || "unknown",
      satisfaction: parsed.satisfaction || "unsure",
      friction: Array.isArray(parsed.friction) ? parsed.friction : [],
      summary: parsed.summary || "No summary available",
    };
  } catch (err) {
    console.error(`Failed to analyze session ${sessionId}:`, err);

    // Return fallback analysis
    return {
      goal: "Analysis failed",
      outcome: "unknown",
      satisfaction: "unsure",
      friction: ["analysis-error"],
      summary: `Failed to analyze: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function summarizeTranscript(transcript: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || transcript.length < 30000) {
    return transcript;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251204",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `Summarize this Claude Code session transcript. Preserve key details like filenames, error messages, and user requests. Keep it concise.\n\n${transcript}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return transcript; // Fallback to original
    }

    const data = await response.json();
    return data.content?.[0]?.text || transcript;
  } catch {
    return transcript; // Fallback to original
  }
}
