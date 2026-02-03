export type ModelProvider =
  | "openai"
  | "openrouter"
  | "anthropic"
  | "google"
  | "gatewayz";

export type ModelValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export type ModelMatchFn = (original: string, normalized: string) => boolean;

export type ModelValidationConfig = {
  allowedMatchers: ModelMatchFn[];
  missingModelMessage: string;
  unsupportedModelMessage: (model: string) => string;
};

const includesMatcher = (value: string): ModelMatchFn => {
  const lookup = value.toLowerCase();
  return (_original, normalized) => normalized.includes(lookup);
};

const exactMatcher = (value: string): ModelMatchFn => {
  const lookup = value.toLowerCase();
  return (_original, normalized) => normalized === lookup;
};

const startsWithMatcher = (value: string): ModelMatchFn => {
  const lookup = value.toLowerCase();
  return (_original, normalized) => normalized.startsWith(lookup);
};

const MODEL_PROVIDER_CONFIG: Record<ModelProvider, ModelValidationConfig> = {
  openai: {
    allowedMatchers: [
      includesMatcher("gpt-5.2"),
      includesMatcher("gpt-5.1-codex-max"),
      includesMatcher("gpt-5.1"),
      includesMatcher("gpt-5"),
    ],
    missingModelMessage: "Model must be specified in request body",
    unsupportedModelMessage: (model) =>
      `Only GPT-5 models are supported. Requested model: ${model}`,
  },
  anthropic: {
    allowedMatchers: [
      includesMatcher("sonnet"),
      includesMatcher("haiku"),
      includesMatcher("opus"),
    ],
    missingModelMessage: "Model must be specified in request body",
    unsupportedModelMessage: (model) =>
      `Only Claude Sonnet, Haiku, or Opus models are supported. Requested model: ${model}`,
  },
  openrouter: {
    allowedMatchers: [
      exactMatcher("x-ai/grok-code-fast-1"),
      startsWithMatcher("qwen/qwen3-coder"),
      startsWithMatcher("moonshotai/kimi-k2"),
      startsWithMatcher("z-ai/glm-4.6"),
      startsWithMatcher("z-ai/glm-4.7"),
      exactMatcher("google/gemini-2.5-pro"),
      startsWithMatcher("google/gemini-3-pro"),
    ],
    missingModelMessage: "Model must be specified in request body",
    unsupportedModelMessage: (model) => `Invalid model requested: ${model}`,
  },
  google: {
    allowedMatchers: [
      startsWithMatcher("gemini-2.5-pro"),
      startsWithMatcher("gemini-2.5-flash"),
      startsWithMatcher("gemini-3-pro"),
    ],
    missingModelMessage: "Model must be specified in request body",
    unsupportedModelMessage: (model) => `Invalid model requested: ${model}`,
  },
  // Gatewayz is a unified gateway that routes to all providers
  // It supports all models from all providers it connects to
  gatewayz: {
    allowedMatchers: [
      // Anthropic models
      includesMatcher("sonnet"),
      includesMatcher("haiku"),
      includesMatcher("opus"),
      includesMatcher("claude"),
      // OpenAI models
      includesMatcher("gpt-5"),
      includesMatcher("gpt-4"),
      includesMatcher("codex"),
      // Google models
      startsWithMatcher("gemini"),
      // Z.AI models
      startsWithMatcher("glm-4"),
      // Chinese/other models
      includesMatcher("grok"),
      startsWithMatcher("qwen"),
      startsWithMatcher("kimi"),
      startsWithMatcher("deepseek"),
      startsWithMatcher("minimax"),
      // Code Router models
      includesMatcher("code-router"),
    ],
    missingModelMessage: "Model must be specified in request body",
    unsupportedModelMessage: (model) =>
      `Model not supported via Gatewayz. Requested model: ${model}`,
  },
};

export function validateProviderModel({
  provider,
  model,
}: {
  provider: ModelProvider;
  model: string | null;
}): ModelValidationResult {
  const config = MODEL_PROVIDER_CONFIG[provider];
  if (!config) {
    return { valid: false, error: `Unknown provider: ${provider}` };
  }
  if (!model) {
    console.error("No model specified", { provider });
    return { valid: false, error: config.missingModelMessage };
  }
  const normalizedModel = model.toLowerCase();
  for (const matcher of config.allowedMatchers) {
    if (matcher(model, normalizedModel)) {
      return { valid: true };
    }
  }
  console.error("Unsupported model", { provider, model });
  return { valid: false, error: config.unsupportedModelMessage(model) };
}
