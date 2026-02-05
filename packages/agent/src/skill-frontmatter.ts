import type { AIAgentSkillFrontmatter } from "./types";

export interface ParsedSkillContent {
  frontmatter: AIAgentSkillFrontmatter;
  body: string;
}

/**
 * Parse YAML frontmatter from a SKILL.md file content.
 * Extracts fields like name, description, argument-hint, etc.
 */
export function parseSkillFrontmatter(
  content: string,
): AIAgentSkillFrontmatter {
  const result: AIAgentSkillFrontmatter = {};

  // Check if content starts with frontmatter delimiter
  if (!content.startsWith("---")) {
    return result;
  }

  // Find the end of frontmatter - look for either '\n---\n' or '\n---' at end of string
  let endIndex = content.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    // Check if file ends with '\n---'
    const endPattern = "\n---";
    if (content.endsWith(endPattern)) {
      endIndex = content.length - endPattern.length;
    } else {
      return result;
    }
  }

  // Extract frontmatter content
  const frontmatterContent = content.substring(4, endIndex);

  // Extract name using regex
  const nameMatch = frontmatterContent.match(/^name:\s*(.+)$/m);
  if (nameMatch?.[1]) {
    result.name = cleanYamlValue(nameMatch[1]);
  }

  // Extract description using regex
  const descriptionMatch = frontmatterContent.match(/^description:\s*(.+)$/m);
  if (descriptionMatch?.[1]) {
    result.description = cleanYamlValue(descriptionMatch[1]);
  }

  // Extract argument-hint using regex (note: YAML uses kebab-case)
  const argumentHintMatch = frontmatterContent.match(
    /^argument-hint:\s*(.+)$/m,
  );
  if (argumentHintMatch?.[1]) {
    result.argumentHint = cleanYamlValue(argumentHintMatch[1]);
  }

  // Extract disable-model-invocation using regex
  const disableModelInvocationMatch = frontmatterContent.match(
    /^disable-model-invocation:\s*(.+)$/m,
  );
  if (disableModelInvocationMatch?.[1]) {
    result.disableModelInvocation = parseBooleanValue(
      disableModelInvocationMatch[1],
    );
  }

  // Extract user-invocable using regex
  const userInvocableMatch = frontmatterContent.match(
    /^user-invocable:\s*(.+)$/m,
  );
  if (userInvocableMatch?.[1]) {
    result.userInvocable = parseBooleanValue(userInvocableMatch[1]);
  }

  // Extract allowed-tools using regex (comma-separated list)
  const allowedToolsMatch = frontmatterContent.match(
    /^allowed-tools:\s*(.+)$/m,
  );
  if (allowedToolsMatch?.[1]) {
    result.allowedTools = cleanYamlValue(allowedToolsMatch[1])
      .split(",")
      .map((tool) => tool.trim())
      .filter(Boolean);
  }

  // Extract model using regex
  const modelMatch = frontmatterContent.match(/^model:\s*(.+)$/m);
  if (modelMatch?.[1]) {
    result.model = cleanYamlValue(modelMatch[1]);
  }

  // Extract context using regex
  const contextMatch = frontmatterContent.match(/^context:\s*(.+)$/m);
  if (contextMatch?.[1]) {
    result.context = cleanYamlValue(contextMatch[1]);
  }

  // Extract agent using regex
  const agentMatch = frontmatterContent.match(/^agent:\s*(.+)$/m);
  if (agentMatch?.[1]) {
    result.agent = cleanYamlValue(agentMatch[1]);
  }

  return result;
}

/**
 * Parse a SKILL.md file and split it into frontmatter and body.
 */
export function parseSkillContent(content: string): ParsedSkillContent {
  const frontmatter = parseSkillFrontmatter(content);

  // Find the end of frontmatter to extract body
  if (!content.startsWith("---")) {
    return { frontmatter, body: content };
  }

  let endIndex = content.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    const endPattern = "\n---";
    if (content.endsWith(endPattern)) {
      return { frontmatter, body: "" };
    }
    return { frontmatter, body: content };
  }

  // Body starts after the closing '---\n'
  const body = content.substring(endIndex + 5).trim();
  return { frontmatter, body };
}

/**
 * Process skill content by replacing argument placeholders.
 * Supports $ARGUMENTS, $0, $1, $2, etc., and ${CLAUDE_SESSION_ID}
 */
export function processSkillArguments(
  skillBody: string,
  args: string,
  sessionId?: string,
): string {
  let processed = skillBody;
  const argParts = args.split(/\s+/).filter(Boolean);

  // Replace positional arguments FIRST (before $ARGUMENTS which would consume them)
  // Replace $ARGUMENTS[N] format
  argParts.forEach((arg, index) => {
    processed = processed.replace(
      new RegExp(`\\$ARGUMENTS\\[${index}\\]`, "g"),
      arg,
    );
  });

  // Replace $N shorthand format (e.g., $0, $1, $2)
  argParts.forEach((arg, index) => {
    processed = processed.replace(new RegExp(`\\$${index}(?!\\d)`, "g"), arg);
  });

  // Replace $ARGUMENTS with full args string (after positional replacements)
  processed = processed.replace(/\$ARGUMENTS/g, args);

  // Replace ${CLAUDE_SESSION_ID} if provided
  if (sessionId) {
    processed = processed.replace(/\$\{CLAUDE_SESSION_ID\}/g, sessionId);
  }

  return processed;
}

/**
 * Clean a YAML value by removing surrounding quotes.
 */
function cleanYamlValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

/**
 * Parse a boolean value from YAML.
 */
function parseBooleanValue(value: string): boolean {
  const cleaned = cleanYamlValue(value).toLowerCase();
  return cleaned === "true" || cleaned === "yes" || cleaned === "1";
}
