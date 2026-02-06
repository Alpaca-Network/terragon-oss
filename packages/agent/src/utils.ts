import {
  AIModel,
  AIAgent,
  AIAgentSlashCommand,
  AgentModelPreferences,
  AIModelSchema,
  AIModelExternal,
  CodeRouterMode,
  CodeRouterSettings,
} from "./types";

const defaultAgent: AIAgent = "claudeCode";

export function ensureAgent(agent: AIAgent | null | undefined): AIAgent {
  if (agent) {
    switch (agent) {
      case "gatewayz":
      case "claudeCode":
      case "gemini":
      case "amp":
      case "codex":
      case "opencode":
        return agent;
      default: {
        const _exhaustiveCheck: never = agent;
        console.warn("Unknown agent", _exhaustiveCheck);
        return defaultAgent;
      }
    }
  }
  return defaultAgent;
}

/**
 * Checks if a model is a Gatewayz Router model
 */
export function isGatewayzModel(model: AIModel | null): boolean {
  return !!model && model.startsWith("gatewayz/");
}

/**
 * Checks if a model is a Gatewayz Code Router model
 */
export function isCodeRouterModel(model: AIModel | null): boolean {
  return !!model && model.startsWith("gatewayz:code:");
}

/**
 * Gets the Code Router optimization mode from a model string
 */
export function getCodeRouterMode(model: AIModel | null): CodeRouterMode {
  if (!model || !isCodeRouterModel(model)) {
    return "balanced";
  }
  if (model === "gatewayz:code:price") {
    return "price";
  }
  if (model === "gatewayz:code:performance") {
    return "quality";
  }
  return "balanced";
}

/**
 * Gets the Code Router model string for a given mode
 */
export function getCodeRouterModelForMode(mode: CodeRouterMode): AIModel {
  switch (mode) {
    case "price":
      return "gatewayz:code:price";
    case "quality":
      return "gatewayz:code:performance";
    case "balanced":
    default:
      return "gatewayz:code:balanced";
  }
}

/**
 * Gets the default Code Router settings
 */
export function getDefaultCodeRouterSettings(): CodeRouterSettings {
  return {
    enabled: false,
    mode: "balanced",
  };
}

/**
 * Gets the underlying agent for a Gatewayz model
 * e.g., "gatewayz/claude-code/sonnet" -> "claudeCode"
 */
export function getUnderlyingAgentForGatewayzModel(
  model: AIModel,
): AIAgent | null {
  if (!model.startsWith("gatewayz/")) return null;
  const parts = model.split("/");
  if (parts.length < 3) return null;
  const agentPart = parts[1];
  switch (agentPart) {
    case "claude-code":
      return "claudeCode";
    case "codex":
      return "codex";
    case "gemini":
      return "gemini";
    case "opencode":
      return "opencode";
    default:
      return null;
  }
}

/**
 * Gets the underlying model name for a Gatewayz model
 * e.g., "gatewayz/claude-code/sonnet" -> "sonnet"
 * e.g., "gatewayz/opencode/glm-4.7" -> "opencode/glm-4.7"
 * For non-Gatewayz models, returns the original model
 */
export function getUnderlyingModelForGatewayz(model: AIModel): AIModel {
  if (!model.startsWith("gatewayz/")) return model;
  const parts = model.split("/");
  if (parts.length < 3) return model;
  const agentPart = parts[1];
  const modelPart = parts.slice(2).join("/");

  // For opencode, the underlying model has the "opencode/" prefix
  if (agentPart === "opencode") {
    const fullModel = `opencode/${modelPart}`;
    if (AIModelSchema.safeParse(fullModel).success) {
      return fullModel as AIModel;
    }
  }

  // For other agents, the underlying model is just the model part
  if (AIModelSchema.safeParse(modelPart).success) {
    return modelPart as AIModel;
  }

  return model;
}

/**
 * Maps an AI model to its corresponding agent type
 */
export function modelToAgent(model: AIModel | null): AIAgent {
  if (!model) {
    return defaultAgent;
  }
  switch (model) {
    // Gatewayz Code Router models
    case "gatewayz:code:balanced":
    case "gatewayz:code:price":
    case "gatewayz:code:performance":
    // Gatewayz Router models
    case "gatewayz/claude-code/opus":
    case "gatewayz/claude-code/sonnet":
    case "gatewayz/claude-code/haiku":
    case "gatewayz/codex/gpt-5.2-codex-high":
    case "gatewayz/codex/gpt-5.2-codex-medium":
    case "gatewayz/codex/gpt-5.1-codex-max":
    case "gatewayz/codex/gpt-5.1-codex-high":
    case "gatewayz/gemini/gemini-3-pro":
    case "gatewayz/gemini/gemini-2.5-pro":
    case "gatewayz/opencode/glm-4.7":
    case "gatewayz/opencode/glm-4.6":
    case "gatewayz/opencode/kimi-k2": {
      return "gatewayz";
    }
    case "gemini-2.5-pro":
    case "gemini-3-pro": {
      return "gemini";
    }
    case "amp": {
      return "amp";
    }
    case "gpt-5":
    case "gpt-5-low":
    case "gpt-5-high":
    case "gpt-5-codex-low":
    case "gpt-5-codex-medium":
    case "gpt-5-codex-high":
    case "gpt-5.2-low":
    case "gpt-5.2":
    case "gpt-5.2-high":
    case "gpt-5.2-xhigh":
    case "gpt-5.1":
    case "gpt-5.1-low":
    case "gpt-5.1-high":
    case "gpt-5.1-codex-low":
    case "gpt-5.1-codex-medium":
    case "gpt-5.1-codex-high":
    case "gpt-5.1-codex-max":
    case "gpt-5.1-codex-max-low":
    case "gpt-5.1-codex-max-high":
    case "gpt-5.1-codex-max-xhigh":
    case "gpt-5.2-codex-low":
    case "gpt-5.2-codex-medium":
    case "gpt-5.2-codex-high":
    case "gpt-5.2-codex-xhigh": {
      return "codex";
    }
    case "opus":
    case "haiku":
    case "sonnet": {
      return "claudeCode";
    }
    case "opencode/grok-code":
    case "opencode/qwen3-coder":
    case "opencode/kimi-k2":
    case "opencode/glm-4.6":
    case "opencode/glm-4.7":
    case "opencode/glm-4.7-flash":
    case "opencode/glm-4.7-lite":
    case "opencode/gemini-2.5-pro":
    case "opencode/gemini-3-pro":
    case "opencode-oai/gpt-5":
    case "opencode-oai/gpt-5-codex":
    case "opencode-ant/sonnet": {
      return "opencode";
    }
    default: {
      const _exhaustiveCheck: never = model;
      console.warn("Unknown model", _exhaustiveCheck);
      return defaultAgent;
    }
  }
}

/**
 * Maps an agent type to its available AI models
 */
export function agentToModels(
  agent: AIAgent | undefined,
  options: {
    agentVersion: number | "latest";
    enableOpenRouterOpenAIAnthropicModel: boolean;
    enableOpencodeGemini3ProModelOption: boolean;
    codeRouterSettings?: CodeRouterSettings;
  },
): AIModel[] {
  agent = agent ?? defaultAgent;
  switch (agent) {
    case "gatewayz": {
      // If Code Router is enabled, only show Code Router models
      if (options.codeRouterSettings?.enabled) {
        return [
          "gatewayz:code:balanced",
          "gatewayz:code:price",
          "gatewayz:code:performance",
        ];
      }
      // Otherwise show individual models (without Code Router options)
      return [
        // Claude Code models via Gatewayz
        "gatewayz/claude-code/sonnet",
        "gatewayz/claude-code/opus",
        "gatewayz/claude-code/haiku",
        // Codex models via Gatewayz
        "gatewayz/codex/gpt-5.2-codex-high",
        "gatewayz/codex/gpt-5.2-codex-medium",
        "gatewayz/codex/gpt-5.1-codex-max",
        "gatewayz/codex/gpt-5.1-codex-high",
        // Gemini models via Gatewayz
        "gatewayz/gemini/gemini-3-pro",
        "gatewayz/gemini/gemini-2.5-pro",
      ];
    }
    case "gemini": {
      return ["gemini-3-pro", "gemini-2.5-pro"];
    }
    case "claudeCode": {
      return ["haiku", "sonnet", "opus"];
    }
    case "amp": {
      return ["amp"];
    }
    case "codex": {
      let models: AIModel[] = [
        "gpt-5-codex-low",
        "gpt-5-codex-medium",
        "gpt-5-codex-high",
        "gpt-5-low",
        "gpt-5",
        "gpt-5-high",
      ];
      if (options.agentVersion === "latest" || options.agentVersion >= 2) {
        models.unshift(
          "gpt-5.1-codex-max-low",
          "gpt-5.1-codex-max",
          "gpt-5.1-codex-max-high",
          "gpt-5.1-codex-max-xhigh",
          "gpt-5.1-codex-low",
          "gpt-5.1-codex-medium",
          "gpt-5.1-codex-high",
          "gpt-5.1-low",
          "gpt-5.1",
          "gpt-5.1-high",
        );
      }
      if (options.agentVersion === "latest" || options.agentVersion >= 3) {
        models.unshift(
          "gpt-5.2-codex-low",
          "gpt-5.2-codex-medium",
          "gpt-5.2-codex-high",
          "gpt-5.2-codex-xhigh",
          "gpt-5.2-low",
          "gpt-5.2",
          "gpt-5.2-high",
          "gpt-5.2-xhigh",
        );
      }
      return models;
    }
    case "opencode": {
      const models: AIModel[] = [
        "opencode/glm-4.7",
        "opencode/glm-4.7-flash",
        "opencode/glm-4.7-lite",
        "opencode/glm-4.6",
        "opencode/kimi-k2",
        "opencode/grok-code",
        "opencode/qwen3-coder",
        "opencode/gemini-2.5-pro",
      ];
      if (options.enableOpencodeGemini3ProModelOption) {
        models.push("opencode/gemini-3-pro");
      }
      if (options.enableOpenRouterOpenAIAnthropicModel) {
        models.push(
          "opencode-oai/gpt-5",
          "opencode-oai/gpt-5-codex",
          "opencode-ant/sonnet",
        );
      }
      return models;
    }
    default: {
      const _exhaustiveCheck: never = agent;
      console.warn("Unknown agent", _exhaustiveCheck);
      return [];
    }
  }
}

export function getDefaultModelForAgent({
  agent,
  agentVersion,
  codeRouterSettings,
}: {
  agent: AIAgent;
  agentVersion: number | "latest";
  codeRouterSettings?: CodeRouterSettings;
}): AIModel {
  switch (agent) {
    case "gatewayz":
      // If Code Router is enabled, use the Code Router model based on mode
      if (codeRouterSettings?.enabled) {
        return getCodeRouterModelForMode(codeRouterSettings.mode);
      }
      return "gatewayz/claude-code/sonnet";
    case "claudeCode":
      return "sonnet";
    case "codex":
      if (agentVersion === "latest" || agentVersion >= 2) {
        return "gpt-5.1-codex-medium";
      }
      return "gpt-5-codex-medium";
    case "amp":
      return "amp";
    case "gemini":
      return "gemini-3-pro";
    case "opencode":
      return "opencode/glm-4.6";
    default:
      const _exhaustiveCheck: never = agent;
      console.warn("Unknown agent", _exhaustiveCheck);
      return "sonnet";
  }
}

export function isImageUploadSupported(model: AIModel | null): boolean {
  // Code Router models support image upload (routing may select a model that supports it)
  if (isCodeRouterModel(model)) {
    return true;
  }
  // For Gatewayz models, check the underlying agent's support
  if (isGatewayzModel(model)) {
    const underlyingAgent = getUnderlyingAgentForGatewayzModel(model!);
    if (underlyingAgent) {
      return isImageUploadSupportedForAgent(underlyingAgent);
    }
    return false;
  }
  const agent = modelToAgent(model);
  return isImageUploadSupportedForAgent(agent);
}

function isImageUploadSupportedForAgent(agent: AIAgent): boolean {
  switch (agent) {
    case "gatewayz":
      // Gatewayz itself doesn't define support - check underlying agent
      return false;
    case "amp":
    case "claudeCode":
    case "codex":
    case "opencode":
      return true;
    case "gemini":
      return false;
    default:
      const _exhaustiveCheck: never = agent;
      console.warn("Unknown agent", _exhaustiveCheck);
      return false;
  }
}

export function isPlanModeSupported(model: AIModel | null): boolean {
  // Code Router models support plan mode (routing may select Claude)
  if (isCodeRouterModel(model)) {
    return true;
  }
  // For Gatewayz models, check if the underlying agent supports plan mode
  if (isGatewayzModel(model)) {
    const underlyingAgent = getUnderlyingAgentForGatewayzModel(model!);
    return underlyingAgent === "claudeCode";
  }
  const agent = modelToAgent(model);
  switch (agent) {
    case "gatewayz":
      // Gatewayz itself doesn't define support - check underlying agent
      return false;
    case "claudeCode":
      return true;
    case "opencode":
    case "codex":
    case "gemini":
    case "amp":
      return false;
    default:
      const _exhaustiveCheck: never = agent;
      console.warn("Unknown agent", _exhaustiveCheck);
      return false;
  }
}

export function isConnectedCredentialsSupported(agent: AIAgent): boolean {
  switch (agent) {
    case "gatewayz":
      return false; // Gatewayz uses its own subscription model
    case "claudeCode":
    case "codex":
    case "amp":
    case "gemini":
      return true;
    case "opencode":
      return false;
    default:
      const _exhaustiveCheck: never = agent;
      console.warn("Unknown agent", _exhaustiveCheck);
      return false;
  }
}

export function isAgentSupportedForCredits(agent: AIAgent): boolean {
  switch (agent) {
    case "gatewayz":
      return false; // Gatewayz uses its own subscription model, not credits
    case "claudeCode":
    case "codex":
    case "opencode":
    case "gemini":
      return true;
    case "amp":
      return false;
    default:
      const _exhaustiveCheck: never = agent;
      console.warn("Unknown agent", _exhaustiveCheck);
      return false;
  }
}

const agentDisplayNameMap: Record<AIAgent, string> = {
  gatewayz: "Gatewayz Router",
  claudeCode: "Claude Code",
  codex: "OpenAI Codex",
  gemini: "Gemini",
  amp: "Amp",
  opencode: "OpenCode",
};

export function getAllAgentTypes(): AIAgent[] {
  const agentTypes = Object.keys(agentDisplayNameMap) as AIAgent[];
  agentTypes.sort(sortByAgents);
  return agentTypes;
}

export function getAgentDisplayName(agent: AIAgent): string {
  return agentDisplayNameMap[agent];
}

export function getAgentProviderDisplayName(agent: AIAgent): string {
  switch (agent) {
    case "gatewayz":
      return "Gatewayz";
    case "claudeCode":
      return "Claude";
    case "codex":
      return "OpenAI";
    case "gemini":
      return "Gemini";
    case "amp":
      return "Amp";
    case "opencode":
      return "OpenCode";
    default:
      const _exhaustiveCheck: never = agent;
      console.warn("Unknown agent", _exhaustiveCheck);
      return "Unknown";
  }
}

type ModelDisplayName = {
  fullName: string;
  mainName: string;
  subName: string | null;
};

export function getModelDisplayName(model: AIModel): ModelDisplayName {
  switch (model) {
    // Gatewayz Code Router models
    case "gatewayz:code:balanced":
      return {
        fullName: "Gatewayz Optimizer (Balanced)",
        mainName: "Gatewayz Optimizer",
        subName: "Balanced",
      };
    case "gatewayz:code:price":
      return {
        fullName: "Gatewayz Optimizer (Price)",
        mainName: "Gatewayz Optimizer",
        subName: "Optimize Price",
      };
    case "gatewayz:code:performance":
      return {
        fullName: "Gatewayz Optimizer (Performance)",
        mainName: "Gatewayz Optimizer",
        subName: "Optimize Performance",
      };
    // Gatewayz Router - Claude Code models
    case "gatewayz/claude-code/opus":
      return {
        fullName: "Opus 4.6",
        mainName: "Opus",
        subName: "4.6",
      };
    case "gatewayz/claude-code/sonnet":
      return {
        fullName: "Sonnet 4.5",
        mainName: "Sonnet",
        subName: "4.5",
      };
    case "gatewayz/claude-code/haiku":
      return {
        fullName: "Haiku 4.5",
        mainName: "Haiku",
        subName: "4.5",
      };
    // Gatewayz Router - Codex models
    case "gatewayz/codex/gpt-5.2-codex-high":
      return {
        fullName: "GPT-5.2 Codex High",
        mainName: "GPT-5.2 Codex",
        subName: "High",
      };
    case "gatewayz/codex/gpt-5.2-codex-medium":
      return {
        fullName: "GPT-5.2 Codex Medium",
        mainName: "GPT-5.2 Codex",
        subName: "Medium",
      };
    case "gatewayz/codex/gpt-5.1-codex-max":
      return {
        fullName: "GPT-5.1 Codex Max",
        mainName: "GPT-5.1 Codex Max",
        subName: null,
      };
    case "gatewayz/codex/gpt-5.1-codex-high":
      return {
        fullName: "GPT-5.1 Codex High",
        mainName: "GPT-5.1 Codex",
        subName: "High",
      };
    // Gatewayz Router - Gemini models
    case "gatewayz/gemini/gemini-3-pro":
      return {
        fullName: "Gemini 3 Pro",
        mainName: "Gemini",
        subName: "3 Pro",
      };
    case "gatewayz/gemini/gemini-2.5-pro":
      return {
        fullName: "Gemini 2.5 Pro",
        mainName: "Gemini",
        subName: "2.5 Pro",
      };
    // Gatewayz Router - OpenCode models
    case "gatewayz/opencode/glm-4.7":
      return {
        fullName: "GLM 4.7",
        mainName: "GLM",
        subName: "4.7",
      };
    case "gatewayz/opencode/glm-4.6":
      return {
        fullName: "GLM 4.6",
        mainName: "GLM",
        subName: "4.6",
      };
    case "gatewayz/opencode/kimi-k2":
      return {
        fullName: "Kimi K2",
        mainName: "Kimi K2",
        subName: null,
      };
    case "opus":
      return {
        fullName: "Opus 4.6",
        mainName: "Opus",
        subName: "4.6",
      };
    case "sonnet":
      return {
        fullName: "Sonnet 4.5",
        mainName: "Sonnet",
        subName: "4.5",
      };
    case "haiku":
      return {
        fullName: "Haiku 4.5",
        mainName: "Haiku",
        subName: "4.5",
      };
    case "gemini-2.5-pro":
      return {
        fullName: "Gemini 2.5 Pro",
        mainName: "Gemini",
        subName: "2.5 Pro",
      };
    case "gemini-3-pro":
      return {
        fullName: "Gemini 3 Pro",
        mainName: "Gemini",
        subName: "3 Pro",
      };
    case "amp":
      return {
        fullName: "Amp",
        mainName: "Amp",
        subName: null,
      };
    case "gpt-5":
      return {
        fullName: "GPT-5 Medium",
        mainName: "GPT-5",
        subName: "Medium",
      };
    case "gpt-5-low":
      return {
        fullName: "GPT-5 Low",
        mainName: "GPT-5",
        subName: "Low",
      };
    case "gpt-5-high":
      return {
        fullName: "GPT-5 High",
        mainName: "GPT-5",
        subName: "High",
      };
    case "gpt-5-codex-medium":
      return {
        fullName: "GPT-5 Codex Medium",
        mainName: "GPT-5 Codex",
        subName: "Medium",
      };
    case "gpt-5-codex-low":
      return {
        fullName: "GPT-5 Codex Low",
        mainName: "GPT-5 Codex",
        subName: "Low",
      };
    case "gpt-5-codex-high":
      return {
        fullName: "GPT-5 Codex High",
        mainName: "GPT-5 Codex",
        subName: "High",
      };
    case "gpt-5.1":
      return {
        fullName: "GPT-5.1 Medium",
        mainName: "GPT-5.1",
        subName: "Medium",
      };
    case "gpt-5.1-low":
      return {
        fullName: "GPT-5.1 Low",
        mainName: "GPT-5.1",
        subName: "Low",
      };
    case "gpt-5.1-high":
      return {
        fullName: "GPT-5.1 High",
        mainName: "GPT-5.1",
        subName: "High",
      };
    case "gpt-5.2":
      return {
        fullName: "GPT-5.2 Medium",
        mainName: "GPT-5.2",
        subName: "Medium",
      };
    case "gpt-5.2-low":
      return {
        fullName: "GPT-5.2 Low",
        mainName: "GPT-5.2",
        subName: "Low",
      };
    case "gpt-5.2-high":
      return {
        fullName: "GPT-5.2 High",
        mainName: "GPT-5.2",
        subName: "High",
      };
    case "gpt-5.2-xhigh":
      return {
        fullName: "GPT-5.2 X-High",
        mainName: "GPT-5.2",
        subName: "X-High",
      };
    case "gpt-5.1-codex-max":
      return {
        fullName: "GPT-5.1 Codex Max (Medium)",
        mainName: "GPT-5.1 Codex Max",
        subName: "Medium",
      };
    case "gpt-5.1-codex-max-low":
      return {
        fullName: "GPT-5.1 Codex Max Low",
        mainName: "GPT-5.1 Codex Max",
        subName: "Low",
      };
    case "gpt-5.1-codex-max-high":
      return {
        fullName: "GPT-5.1 Codex Max High",
        mainName: "GPT-5.1 Codex Max",
        subName: "High",
      };
    case "gpt-5.1-codex-max-xhigh":
      return {
        fullName: "GPT-5.1 Codex Max X-High",
        mainName: "GPT-5.1 Codex Max",
        subName: "X-High",
      };
    case "gpt-5.1-codex-medium":
      return {
        fullName: "GPT-5.1 Codex Medium",
        mainName: "GPT-5.1 Codex",
        subName: "Medium",
      };
    case "gpt-5.1-codex-low":
      return {
        fullName: "GPT-5.1 Codex Low",
        mainName: "GPT-5.1 Codex",
        subName: "Low",
      };
    case "gpt-5.1-codex-high":
      return {
        fullName: "GPT-5.1 Codex High",
        mainName: "GPT-5.1 Codex",
        subName: "High",
      };
    case "gpt-5.2-codex-low":
      return {
        fullName: "GPT-5.2 Codex Low",
        mainName: "GPT-5.2 Codex",
        subName: "Low",
      };
    case "gpt-5.2-codex-medium":
      return {
        fullName: "GPT-5.2 Codex Medium",
        mainName: "GPT-5.2 Codex",
        subName: "Medium",
      };
    case "gpt-5.2-codex-high":
      return {
        fullName: "GPT-5.2 Codex High",
        mainName: "GPT-5.2 Codex",
        subName: "High",
      };
    case "gpt-5.2-codex-xhigh":
      return {
        fullName: "GPT-5.2 Codex X-High",
        mainName: "GPT-5.2 Codex",
        subName: "X-High",
      };
    case "opencode/grok-code":
      return {
        fullName: "Grok Code Fast 1",
        mainName: "Grok Code Fast",
        subName: "1",
      };
    case "opencode/qwen3-coder":
      return {
        fullName: "Qwen3 Coder 480B",
        mainName: "Qwen3 Coder",
        subName: "480B",
      };
    case "opencode/kimi-k2":
      return {
        fullName: "Kimi K2",
        mainName: "Kimi K2",
        subName: null,
      };
    case "opencode/glm-4.6":
      return {
        fullName: "GLM 4.6",
        mainName: "GLM",
        subName: "4.6",
      };
    case "opencode/glm-4.7":
      return {
        fullName: "GLM 4.7",
        mainName: "GLM",
        subName: "4.7",
      };
    case "opencode/glm-4.7-flash":
      return {
        fullName: "GLM 4.7 Flash",
        mainName: "GLM",
        subName: "4.7 Flash",
      };
    case "opencode/glm-4.7-lite":
      return {
        fullName: "GLM 4.7 Lite",
        mainName: "GLM",
        subName: "4.7 Lite",
      };
    case "opencode/gemini-2.5-pro":
      return {
        fullName: "Gemini 2.5 Pro",
        mainName: "Gemini",
        subName: "2.5 Pro",
      };
    case "opencode/gemini-3-pro":
      return {
        fullName: "Gemini 3 Pro",
        mainName: "Gemini",
        subName: "3 Pro",
      };
    case "opencode-oai/gpt-5":
      return {
        fullName: "GPT-5",
        mainName: "GPT-5",
        subName: null,
      };
    case "opencode-oai/gpt-5-codex":
      return {
        fullName: "GPT-5 Codex",
        mainName: "GPT-5 Codex",
        subName: null,
      };
    case "opencode-ant/sonnet":
      return {
        fullName: "Sonnet 4.5",
        mainName: "Sonnet",
        subName: "4.5",
      };
    default:
      const _exhaustiveCheck: never = model;
      console.warn("Unknown model", _exhaustiveCheck);
      return {
        fullName: _exhaustiveCheck,
        mainName: _exhaustiveCheck,
        subName: null,
      };
  }
}

export type AgentModelGroup = {
  agent: AIAgent;
  label: string;
  models: AIModel[];
};

export function getAgentModelGroups({
  agent,
  agentModelPreferences,
  selectedModels = [],
  options,
}: {
  agent: AIAgent;
  agentModelPreferences: AgentModelPreferences;
  selectedModels?: AIModel[];
  options: {
    agentVersion: number;
    enableOpenRouterOpenAIAnthropicModel: boolean;
    enableOpencodeGemini3ProModelOption: boolean;
    codeRouterSettings?: CodeRouterSettings;
  };
}): AgentModelGroup {
  return {
    agent,
    label: agentDisplayNameMap[agent],
    models: agentToModels(agent, options).filter((model) => {
      if (selectedModels.includes(model)) {
        return true;
      }
      const userPreference = agentModelPreferences.models?.[model];
      if (typeof userPreference === "boolean") {
        return userPreference;
      }
      return isModelEnabledByDefault({
        model,
        agentVersion: options.agentVersion,
      });
    }),
  };
}

// Universal commands that work for all agents
const UNIVERSAL_SLASH_COMMANDS: AIAgentSlashCommand[] = [
  {
    name: "clear",
    description: "Clear conversation history",
  },
  {
    name: "compact",
    description: "Compact conversation",
  },
];

export function getAgentSlashCommands(agent: AIAgent): AIAgentSlashCommand[] {
  const cmds: AIAgentSlashCommand[] = [...UNIVERSAL_SLASH_COMMANDS];
  switch (agent) {
    case "gatewayz":
      // Gatewayz supports Claude Code commands when using Claude Code models
      cmds.push(
        {
          name: "init",
          description: "Initialize project with CLAUDE.md guide",
        },
        {
          name: "pr-comments",
          description: "View pull request comments",
        },
        {
          name: "review",
          description: "Request code review",
        },
      );
      break;
    case "claudeCode":
      cmds.push(
        {
          name: "init",
          description: "Initialize project with CLAUDE.md guide",
        },
        {
          name: "pr-comments",
          description: "View pull request comments",
        },
        {
          name: "review",
          description: "Request code review",
        },
      );
      break;
    default:
      break;
  }
  return cmds;
}

const agentSortOrder: Record<AIAgent, number> = {
  gatewayz: -1, // Gatewayz Router at the top
  claudeCode: 0,
  codex: 1,
  gemini: 2,
  opencode: 3,
  amp: 4,
};

export function sortByAgents(a: AIAgent, b: AIAgent): number {
  const aIndex = agentSortOrder[a] ?? 100;
  const bIndex = agentSortOrder[b] ?? 100;
  return aIndex - bIndex;
}

export function isAgentEnabledByDefault(agent: AIAgent): boolean {
  switch (agent) {
    case "gatewayz":
    case "claudeCode":
    case "codex":
    case "opencode":
    case "gemini":
      return true;
    case "amp":
      return false;
    default:
      const _exhaustiveCheck: never = agent;
      console.warn("Unknown agent", _exhaustiveCheck);
      return false;
  }
}

export function isModelEnabledByDefault({
  model,
  agentVersion,
}: {
  model: AIModel;
  agentVersion: number | "latest";
}): boolean {
  switch (model) {
    // Gatewayz Code Router models - all enabled by default
    case "gatewayz:code:balanced":
    case "gatewayz:code:price":
    case "gatewayz:code:performance":
    // Gatewayz Router models - all enabled by default
    case "gatewayz/claude-code/opus":
    case "gatewayz/claude-code/sonnet":
    case "gatewayz/claude-code/haiku":
    case "gatewayz/codex/gpt-5.2-codex-high":
    case "gatewayz/codex/gpt-5.2-codex-medium":
    case "gatewayz/codex/gpt-5.1-codex-max":
    case "gatewayz/codex/gpt-5.1-codex-high":
    case "gatewayz/gemini/gemini-3-pro":
    case "gatewayz/gemini/gemini-2.5-pro":
    case "gatewayz/opencode/glm-4.7":
    case "gatewayz/opencode/glm-4.6":
    case "gatewayz/opencode/kimi-k2":
      return true;
    // Deprecate the non-codex models
    case "gpt-5":
    case "gpt-5-low":
    case "gpt-5-high":
    case "gpt-5.1":
    case "gpt-5.1-low":
    case "gpt-5.1-high":
    case "gpt-5.2":
    case "gpt-5.2-low":
    case "gpt-5.2-high":
    case "gpt-5.2-xhigh":
      return false;
    case "gpt-5-codex-low":
    case "gpt-5-codex-medium":
    case "gpt-5-codex-high":
      return agentVersion !== "latest" && agentVersion < 2;
    // TODO: Which to deprecate?
    case "opencode/grok-code":
    case "opencode/qwen3-coder":
    case "opencode/gemini-2.5-pro":
    case "opencode/gemini-3-pro":
    case "opencode-oai/gpt-5":
    case "opencode-oai/gpt-5-codex":
    case "opencode-ant/sonnet":
      return false;
    case "opus":
    case "sonnet":
    case "haiku":
      return true;
    case "gemini-3-pro":
    case "gemini-2.5-pro":
      return true;
    case "amp":
      return true;
    case "gpt-5.1-codex-max":
    case "gpt-5.1-codex-max-low":
    case "gpt-5.1-codex-max-high":
    case "gpt-5.1-codex-max-xhigh":
      return true;
    case "gpt-5.1-codex-low":
    case "gpt-5.1-codex-medium":
    case "gpt-5.1-codex-high":
    case "gpt-5.2-codex-low":
    case "gpt-5.2-codex-medium":
    case "gpt-5.2-codex-high":
    case "gpt-5.2-codex-xhigh":
      return true;
    case "opencode/kimi-k2":
    case "opencode/glm-4.6":
    case "opencode/glm-4.7":
    case "opencode/glm-4.7-flash":
    case "opencode/glm-4.7-lite":
      return true;
    default:
      const _exhaustiveCheck: never = model;
      console.warn("Unknown model", _exhaustiveCheck);
      return false;
  }
}

export function getAgentInfo(agent: AIAgent): string {
  switch (agent) {
    case "gatewayz":
      return "Gatewayz Router provides unified access to multiple AI providers through a single subscription.";
    case "claudeCode":
      return "";
    case "codex":
      return "";
    case "opencode":
      return "OpenCode is an open source agent that allows you to use a wide variety of models.";
    case "gemini":
      return "";
    case "amp":
      return "Amp is a coding agent built by Sourcegraph.";
    default:
      const _exhaustiveCheck: never = agent;
      console.warn("Unknown agent", _exhaustiveCheck);
      return "";
  }
}

export function getModelInfo(model: AIModel): string {
  switch (model) {
    case "sonnet":
      return "Recommended for most tasks";
    case "gatewayz:code:balanced":
      return "Improves code gen tasks while cutting the cost of inference by 35% to 71%";
    case "gatewayz:code:price":
      return "Maximize cost savings with intelligent model routing";
    case "gatewayz:code:performance":
      return "Maximize performance with intelligent model routing";
  }
  return "";
}

function isExactModelMatch(modelName: string): modelName is AIModel {
  return AIModelSchema.safeParse(modelName).success;
}

/**
 * Parses a model name string (supporting aliases and shortcuts)
 */
export function parseModelOrNull({
  modelName,
}: {
  modelName: string | undefined;
}): AIModel | null {
  if (!modelName) {
    return null;
  }
  // Make sure we handle all the supported AIModelExternal types
  const modelAsExternal = modelName as AIModelExternal;
  if (isExactModelMatch(modelAsExternal)) {
    return modelAsExternal;
  }
  switch (modelAsExternal) {
    case "gpt-5-medium":
      return "gpt-5";
    case "gpt-5.1-medium":
      return "gpt-5.1";
    case "gpt-5.2-medium":
      return "gpt-5.2";
    case "gpt-5.1-codex-max-medium":
      return "gpt-5.1-codex-max";
    case "gpt-5-codex":
      return "gpt-5-codex-medium";
    case "gpt-5.1-codex":
      return "gpt-5.1-codex-medium";
    case "gpt-5.2-codex":
      return "gpt-5.2-codex-medium";
    case "grok-code":
      return "opencode/grok-code";
    case "qwen3-coder":
      return "opencode/qwen3-coder";
    case "kimi-k2":
      return "opencode/kimi-k2";
    case "glm-4.6":
      return "opencode/glm-4.6";
    case "glm-4.7":
      return "opencode/glm-4.7";
    case "glm-4.7-flash":
      return "opencode/glm-4.7-flash";
    case "glm-4.7-lite":
      return "opencode/glm-4.7-lite";
    case "opencode/gpt-5":
      return "opencode-oai/gpt-5";
    case "opencode/gpt-5-codex":
      return "opencode-oai/gpt-5-codex";
    case "opencode/sonnet":
      return "opencode-ant/sonnet";
    // Legacy gatewayz code router model names (for backward compatibility)
    case "gatewayz/code-router":
      return "gatewayz:code:balanced";
    case "gatewayz/code-router/price":
      return "gatewayz:code:price";
    case "gatewayz/code-router/quality":
      return "gatewayz:code:performance";
    default:
      const _exhaustiveCheck: never = modelAsExternal;
      console.warn("Unknown model name", _exhaustiveCheck);
      return null;
  }
}

export function normalizedModelForDaemon(model: AIModel): string {
  // Handle Gatewayz models - extract the underlying model and normalize it
  // The daemon will use the Gatewayz proxy based on the useGatewayz flag
  if (model.startsWith("gatewayz/")) {
    const underlyingModel = getUnderlyingModelForGatewayz(model);
    // Recursively normalize the underlying model
    return normalizedModelForDaemon(underlyingModel);
  }
  // Switch to using the google proxy
  // For now, just switch gemini-3-pro to the google proxy
  if (model === "opencode/gemini-3-pro") {
    return "terry-google/gemini-3-pro";
  }
  if (model.startsWith("opencode/")) {
    return model.replace("opencode/", "terry/");
  }
  if (model.startsWith("opencode-google/")) {
    return model.replace("opencode-google/", "terry-google/");
  }
  if (model.startsWith("opencode-oai")) {
    return model.replace("opencode-oai/", "terry-oai/");
  }
  if (model.startsWith("opencode-ant")) {
    return model.replace("opencode-ant/", "terry-ant/");
  }
  if (model === "gemini-3-pro") {
    return "gemini-3-pro-preview";
  }
  return model;
}

/**
 * Returns true if the model requires ChatGPT OAuth credentials to use.
 * These models cannot fall back to built-in credits.
 */
export function modelRequiresChatGptOAuth(model: AIModel | null): boolean {
  if (!model) {
    return false;
  }
  switch (model) {
    case "gpt-5.2-codex-low":
    case "gpt-5.2-codex-medium":
    case "gpt-5.2-codex-high":
    case "gpt-5.2-codex-xhigh":
      return true;
    default:
      return false;
  }
}
