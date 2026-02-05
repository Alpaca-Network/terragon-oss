import * as z from "zod/v4";

// Code Router optimization modes for Gatewayz integration
export const CodeRouterModeSchema = z.enum([
  "balanced", // Default: balanced optimization for price/performance
  "price", // Optimize for lowest cost
  "quality", // Optimize for highest quality/performance
]);

export type CodeRouterMode = z.infer<typeof CodeRouterModeSchema>;

export const AIModelSchema = z.enum([
  // gatewayz code router - intelligent model selection
  "gatewayz:code:balanced", // Default balanced mode
  "gatewayz:code:price", // Optimize for cost
  "gatewayz:code:performance", // Optimize for performance

  // gatewayz router - Claude Code models
  "gatewayz/claude-code/opus",
  "gatewayz/claude-code/sonnet",
  "gatewayz/claude-code/haiku",

  // gatewayz router - Codex models
  "gatewayz/codex/gpt-5.2-codex-high",
  "gatewayz/codex/gpt-5.2-codex-medium",
  "gatewayz/codex/gpt-5.1-codex-max",
  "gatewayz/codex/gpt-5.1-codex-high",

  // gatewayz router - Gemini models
  "gatewayz/gemini/gemini-3-pro",
  "gatewayz/gemini/gemini-2.5-pro",

  // gatewayz router - OpenCode models
  "gatewayz/opencode/glm-4.7",
  "gatewayz/opencode/glm-4.6",
  "gatewayz/opencode/kimi-k2",

  // claude code
  "opus",
  "sonnet",
  "haiku",

  // gemini
  "gemini-2.5-pro",
  "gemini-3-pro",

  // amp
  "amp",

  // codex
  "gpt-5",
  "gpt-5-low",
  "gpt-5-high",
  "gpt-5-codex-low",
  "gpt-5-codex-medium",
  "gpt-5-codex-high",
  "gpt-5.2-low",
  "gpt-5.2",
  "gpt-5.2-high",
  "gpt-5.2-xhigh",
  "gpt-5.1",
  "gpt-5.1-low",
  "gpt-5.1-high",
  "gpt-5.1-codex-low",
  "gpt-5.1-codex-medium",
  "gpt-5.1-codex-high",
  "gpt-5.1-codex-max",
  "gpt-5.1-codex-max-low",
  "gpt-5.1-codex-max-high",
  "gpt-5.1-codex-max-xhigh",
  "gpt-5.2-codex-low",
  "gpt-5.2-codex-medium",
  "gpt-5.2-codex-high",
  "gpt-5.2-codex-xhigh",

  // opencode
  "opencode/grok-code",
  "opencode/qwen3-coder",
  "opencode/kimi-k2",
  "opencode/glm-4.6",
  "opencode/glm-4.7",
  "opencode/glm-4.7-flash",
  "opencode/glm-4.7-lite",
  "opencode/gemini-2.5-pro",
  "opencode/gemini-3-pro",
  "opencode-oai/gpt-5",
  "opencode-oai/gpt-5-codex",
  "opencode-ant/sonnet",
]);

// Augment AIModelSchema with simpler names for external usage
export const AIModelExternalSchema = z.enum([
  ...AIModelSchema.options,
  "gpt-5-medium",
  "gpt-5.1-medium",
  "gpt-5.2-medium",
  "gpt-5-codex",
  "gpt-5.1-codex",
  "gpt-5.1-codex-max-medium",
  "gpt-5.2-codex",
  "grok-code",
  "qwen3-coder",
  "kimi-k2",
  "glm-4.6",
  "glm-4.7",
  "glm-4.7-flash",
  "glm-4.7-lite",
  "opencode/gpt-5",
  "opencode/gpt-5-codex",
  "opencode/sonnet",
  // Legacy gatewayz code router model names (for backward compatibility)
  "gatewayz/code-router",
  "gatewayz/code-router/price",
  "gatewayz/code-router/quality",
]);

export type AIModel = z.infer<typeof AIModelSchema>;
export type AIModelExternal = z.infer<typeof AIModelExternalSchema>;

export const AIAgentSchema = z.enum([
  "gatewayz",
  "claudeCode",
  "gemini",
  "amp",
  "codex",
  "opencode",
]);

export type AIAgent = z.infer<typeof AIAgentSchema>;

export type AIAgentCredentials =
  | { type: "env-var"; key: string; value: string }
  | { type: "json-file"; contents: string }
  | { type: "built-in-credits" };

export type AIAgentSlashCommand = {
  name: string;
  description: string;
  isLoading?: boolean;
};

// Skill frontmatter fields from SKILL.md files
export type AIAgentSkillFrontmatter = {
  name?: string;
  description?: string;
  argumentHint?: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  // Phase 2 fields (not yet implemented)
  allowedTools?: string[];
  model?: string;
  context?: string;
  agent?: string;
};

// Skill metadata for display in UI and model context
export type AIAgentSkill = {
  name: string;
  description: string;
  argumentHint?: string;
  disableModelInvocation: boolean;
  userInvocable: boolean;
  type: "skill";
  filePath: string;
  isLoading?: boolean;
};

// Union type for slash commands and skills
export type AIAgentSlashCommandOrSkill = AIAgentSlashCommand | AIAgentSkill;

// Type guard to check if an item is a skill
export function isSkill(
  item: AIAgentSlashCommandOrSkill,
): item is AIAgentSkill {
  return "type" in item && item.type === "skill";
}

export type SelectedAIModels = {
  [model in AIModel]?: number;
};

export type AgentModelPreferences = {
  agents?: { [agent in AIAgent]?: boolean };
  models?: { [model in AIModel]?: boolean };
};

// Code Router settings for Gatewayz integration
export type CodeRouterSettings = {
  // Whether to use the Code Router for Gatewayz models
  enabled: boolean;
  // Optimization mode: balanced (default), price, or quality
  mode: CodeRouterMode;
};
