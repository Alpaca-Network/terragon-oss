import { describe, it, expect } from "vitest";
import { validateProviderModel, type ModelProvider } from "./proxy";

describe("validateProviderModel", () => {
  describe("gatewayz provider", () => {
    const provider: ModelProvider = "gatewayz";

    describe("Code Router models", () => {
      it("should allow gatewayz/code-router model", () => {
        const result = validateProviderModel({
          provider,
          model: "gatewayz/code-router",
        });
        expect(result).toEqual({ valid: true });
      });

      it("should allow gatewayz/code-router/price model", () => {
        const result = validateProviderModel({
          provider,
          model: "gatewayz/code-router/price",
        });
        expect(result).toEqual({ valid: true });
      });

      it("should allow gatewayz/code-router/quality model", () => {
        const result = validateProviderModel({
          provider,
          model: "gatewayz/code-router/quality",
        });
        expect(result).toEqual({ valid: true });
      });
    });

    describe("Claude models", () => {
      it("should allow gatewayz/claude-code/opus model", () => {
        const result = validateProviderModel({
          provider,
          model: "gatewayz/claude-code/opus",
        });
        expect(result).toEqual({ valid: true });
      });

      it("should allow gatewayz/claude-code/sonnet model", () => {
        const result = validateProviderModel({
          provider,
          model: "gatewayz/claude-code/sonnet",
        });
        expect(result).toEqual({ valid: true });
      });

      it("should allow gatewayz/claude-code/haiku model", () => {
        const result = validateProviderModel({
          provider,
          model: "gatewayz/claude-code/haiku",
        });
        expect(result).toEqual({ valid: true });
      });
    });

    describe("OpenAI models", () => {
      it("should allow gatewayz/codex/gpt-5.2-codex-high model", () => {
        const result = validateProviderModel({
          provider,
          model: "gatewayz/codex/gpt-5.2-codex-high",
        });
        expect(result).toEqual({ valid: true });
      });

      it("should allow gatewayz/codex/gpt-5.1-codex-max model", () => {
        const result = validateProviderModel({
          provider,
          model: "gatewayz/codex/gpt-5.1-codex-max",
        });
        expect(result).toEqual({ valid: true });
      });
    });

    describe("Google models", () => {
      it("should allow gemini-3-pro model", () => {
        const result = validateProviderModel({
          provider,
          model: "gemini-3-pro",
        });
        expect(result).toEqual({ valid: true });
      });

      it("should allow gemini-2.5-pro model", () => {
        const result = validateProviderModel({
          provider,
          model: "gemini-2.5-pro",
        });
        expect(result).toEqual({ valid: true });
      });
    });

    describe("OpenCode models", () => {
      it("should allow glm-4.7 model", () => {
        const result = validateProviderModel({
          provider,
          model: "glm-4.7",
        });
        expect(result).toEqual({ valid: true });
      });

      it("should allow kimi-k2 model", () => {
        const result = validateProviderModel({
          provider,
          model: "kimi-k2",
        });
        expect(result).toEqual({ valid: true });
      });
    });

    describe("invalid models", () => {
      it("should reject unknown model", () => {
        const result = validateProviderModel({
          provider,
          model: "unknown/model",
        });
        expect(result).toEqual({
          valid: false,
          error:
            "Model not supported via Gatewayz. Requested model: unknown/model",
        });
      });

      it("should reject when model is null", () => {
        const result = validateProviderModel({
          provider,
          model: null,
        });
        expect(result).toEqual({
          valid: false,
          error: "Model must be specified in request body",
        });
      });
    });
  });

  describe("openai provider", () => {
    const provider: ModelProvider = "openai";

    it("should allow gpt-5.2 model", () => {
      const result = validateProviderModel({
        provider,
        model: "gpt-5.2",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should allow gpt-5.1-codex-max model", () => {
      const result = validateProviderModel({
        provider,
        model: "gpt-5.1-codex-max",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should reject gpt-4 model", () => {
      const result = validateProviderModel({
        provider,
        model: "gpt-4",
      });
      expect(result).toEqual({
        valid: false,
        error: "Only GPT-5 models are supported. Requested model: gpt-4",
      });
    });
  });

  describe("anthropic provider", () => {
    const provider: ModelProvider = "anthropic";

    it("should allow claude-sonnet model", () => {
      const result = validateProviderModel({
        provider,
        model: "claude-sonnet-4",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should allow claude-opus model", () => {
      const result = validateProviderModel({
        provider,
        model: "claude-opus-4",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should reject unsupported model", () => {
      const result = validateProviderModel({
        provider,
        model: "unsupported-model",
      });
      expect(result).toEqual({
        valid: false,
        error:
          "Only Claude Sonnet, Haiku, or Opus models are supported. Requested model: unsupported-model",
      });
    });
  });

  describe("openrouter provider", () => {
    const provider: ModelProvider = "openrouter";

    it("should allow x-ai/grok-code-fast-1 model", () => {
      const result = validateProviderModel({
        provider,
        model: "x-ai/grok-code-fast-1",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should allow qwen/qwen3-coder models", () => {
      const result = validateProviderModel({
        provider,
        model: "qwen/qwen3-coder-235b",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should allow moonshotai/kimi-k2 models", () => {
      const result = validateProviderModel({
        provider,
        model: "moonshotai/kimi-k2",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should allow z-ai/glm-4 models", () => {
      const result = validateProviderModel({
        provider,
        model: "z-ai/glm-4.6",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should allow google/gemini models", () => {
      const result = validateProviderModel({
        provider,
        model: "google/gemini-2.5-pro",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should reject invalid model", () => {
      const result = validateProviderModel({
        provider,
        model: "invalid/model",
      });
      expect(result).toEqual({
        valid: false,
        error: "Invalid model requested: invalid/model",
      });
    });
  });

  describe("google provider", () => {
    const provider: ModelProvider = "google";

    it("should allow gemini-2.5-pro model", () => {
      const result = validateProviderModel({
        provider,
        model: "gemini-2.5-pro",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should allow gemini-2.5-flash model", () => {
      const result = validateProviderModel({
        provider,
        model: "gemini-2.5-flash",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should allow gemini-3-pro models", () => {
      const result = validateProviderModel({
        provider,
        model: "gemini-3-pro-001",
      });
      expect(result).toEqual({ valid: true });
    });

    it("should reject invalid model", () => {
      const result = validateProviderModel({
        provider,
        model: "gpt-4",
      });
      expect(result).toEqual({
        valid: false,
        error: "Invalid model requested: gpt-4",
      });
    });
  });

  describe("unknown provider", () => {
    it("should reject unknown provider", () => {
      const result = validateProviderModel({
        provider: "unknown" as ModelProvider,
        model: "some-model",
      });
      expect(result).toEqual({
        valid: false,
        error: "Unknown provider: unknown",
      });
    });
  });
});
