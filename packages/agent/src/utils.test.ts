import { describe, it, expect } from "vitest";
import {
  modelToAgent,
  agentToModels,
  sortByAgents,
  getAgentModelGroups,
  parseModelOrNull,
  isGatewayzModel,
  getUnderlyingAgentForGatewayzModel,
  getUnderlyingModelForGatewayz,
  normalizedModelForDaemon,
  isConnectedCredentialsSupported,
  isCodeRouterModel,
  getCodeRouterMode,
  getCodeRouterModelForMode,
  getDefaultCodeRouterSettings,
  getDefaultModelForAgent,
  isPlanModeSupported,
  isImageUploadSupported,
} from "./utils";
import { AIModel, AIAgent } from "./types";
import { AGENT_VERSION } from "./versions";

const options = {
  agentVersion: AGENT_VERSION,
  enableOpenRouterOpenAIAnthropicModel: true,
  enableOpencodeGemini3ProModelOption: true,
};

describe("model-to-agent", () => {
  describe("modelToAgent and agentToModels consistency", () => {
    it("should have bidirectional consistency between functions", () => {
      const agents: AIAgent[] = ["claudeCode", "gemini", "amp", "codex"];

      agents.forEach((agent) => {
        const models = agentToModels(agent, options);
        models.forEach((model) => {
          expect(modelToAgent(model)).toBe(agent);
        });
      });
    });

    it("should map all models back to their original agents", () => {
      const modelAgentPairs: [AIModel, AIAgent][] = [
        ["opus", "claudeCode"],
        ["sonnet", "claudeCode"],
        ["gemini-2.5-pro", "gemini"],
        ["amp", "amp"],
        ["gpt-5-low", "codex"],
        ["gpt-5", "codex"],
        ["gpt-5-high", "codex"],
        ["gpt-5-codex-low", "codex"],
        ["gpt-5-codex-medium", "codex"],
        ["gpt-5-codex-high", "codex"],
        ["gpt-5.1-codex-max", "codex"],
      ];

      modelAgentPairs.forEach(([model, expectedAgent]) => {
        const agent = modelToAgent(model);
        expect(agent).toBe(expectedAgent);
        const models = agentToModels(agent, options);
        expect(models).toContain(model);
      });
    });
  });

  describe("sortByAgents", () => {
    it("should sort agents by their order", () => {
      const agents: AIAgent[] = ["claudeCode", "gemini", "amp", "codex"];
      const sortedAgents = agents.sort(sortByAgents);
      expect(sortedAgents).toEqual(["claudeCode", "codex", "gemini", "amp"]);
    });

    it("should sort gatewayz first", () => {
      const agents: AIAgent[] = [
        "claudeCode",
        "gatewayz",
        "codex",
        "gemini",
        "amp",
      ];
      const sortedAgents = agents.sort(sortByAgents);
      expect(sortedAgents[0]).toBe("gatewayz");
    });
  });

  describe("getAgentModelGroups", () => {
    it("should include selected models even when disabled by preferences", () => {
      const result = getAgentModelGroups({
        agent: "claudeCode",
        agentModelPreferences: {
          models: {
            opus: false, // Opus is disabled
            sonnet: true,
            haiku: true,
          },
        },
        selectedModels: ["opus"], // But opus is currently selected
        options,
      });

      expect(result.models).toContain("opus");
      expect(result.models).toContain("sonnet");
      expect(result.models).toContain("haiku");
    });

    it("should filter out disabled models when not selected", () => {
      const result = getAgentModelGroups({
        agent: "claudeCode",
        agentModelPreferences: {
          models: {
            opus: false, // Opus is disabled
            sonnet: true,
            haiku: true,
          },
        },
        selectedModels: [], // Opus is not selected
        options,
      });

      expect(result.models).not.toContain("opus");
      expect(result.models).toContain("sonnet");
      expect(result.models).toContain("haiku");
    });

    it("should use default preferences when not specified", () => {
      const result = getAgentModelGroups({
        agent: "codex",
        agentModelPreferences: { models: {} },
        selectedModels: [],
        options,
      });
      expect(result.models).toContain("gpt-5.1-codex-medium");
      expect(result.models).not.toContain("gpt-5");
    });
  });

  describe("parseModelOrNull", () => {
    it("should parse exact model names", () => {
      expect(parseModelOrNull({ modelName: "opus" })).toBe("opus");
      expect(parseModelOrNull({ modelName: "sonnet" })).toBe("sonnet");
      expect(parseModelOrNull({ modelName: "haiku" })).toBe("haiku");
      expect(parseModelOrNull({ modelName: "gpt-5" })).toBe("gpt-5");
      expect(parseModelOrNull({ modelName: "gpt-5.1-codex-max" })).toBe(
        "gpt-5.1-codex-max",
      );
      expect(parseModelOrNull({ modelName: "gemini-2.5-pro" })).toBe(
        "gemini-2.5-pro",
      );
      expect(parseModelOrNull({ modelName: "opencode/grok-code" })).toBe(
        "opencode/grok-code",
      );
    });

    it("should parse shortcut model names with opencode/ prefix", () => {
      expect(parseModelOrNull({ modelName: "grok-code" })).toBe(
        "opencode/grok-code",
      );
      expect(parseModelOrNull({ modelName: "qwen3-coder" })).toBe(
        "opencode/qwen3-coder",
      );
      expect(parseModelOrNull({ modelName: "kimi-k2" })).toBe(
        "opencode/kimi-k2",
      );
      expect(parseModelOrNull({ modelName: "gpt-5.1-codex-max-medium" })).toBe(
        "gpt-5.1-codex-max",
      );
      expect(parseModelOrNull({ modelName: "glm-4.6" })).toBe(
        "opencode/glm-4.6",
      );
    });

    it("should return null for invalid model names", () => {
      expect(parseModelOrNull({ modelName: "invalid-model" })).toBe(null);
      expect(parseModelOrNull({ modelName: "" })).toBe(null);
      expect(parseModelOrNull({ modelName: "gpt-4" })).toBe(null);
    });

    it("should map legacy gatewayz code router model names to new format", () => {
      expect(parseModelOrNull({ modelName: "gatewayz/code-router" })).toBe(
        "gatewayz:code:balanced",
      );
      expect(
        parseModelOrNull({ modelName: "gatewayz/code-router/price" }),
      ).toBe("gatewayz:code:price");
      expect(
        parseModelOrNull({ modelName: "gatewayz/code-router/quality" }),
      ).toBe("gatewayz:code:performance");
    });
  });

  describe("gatewayz model utilities", () => {
    describe("isGatewayzModel", () => {
      it("should return true for Gatewayz models", () => {
        expect(isGatewayzModel("gatewayz/claude-code/opus")).toBe(true);
        expect(isGatewayzModel("gatewayz/claude-code/sonnet")).toBe(true);
        expect(isGatewayzModel("gatewayz/codex/gpt-5.1-codex-max")).toBe(true);
        expect(isGatewayzModel("gatewayz/gemini/gemini-3-pro")).toBe(true);
        expect(isGatewayzModel("gatewayz/opencode/glm-4.7")).toBe(true);
      });

      it("should return false for non-Gatewayz models", () => {
        expect(isGatewayzModel("opus")).toBe(false);
        expect(isGatewayzModel("sonnet")).toBe(false);
        expect(isGatewayzModel("gpt-5")).toBe(false);
        expect(isGatewayzModel("gemini-2.5-pro")).toBe(false);
        expect(isGatewayzModel("opencode/grok-code")).toBe(false);
      });

      it("should return false for null", () => {
        expect(isGatewayzModel(null)).toBe(false);
      });
    });

    describe("getUnderlyingAgentForGatewayzModel", () => {
      it("should return the underlying agent for Gatewayz Claude Code models", () => {
        expect(
          getUnderlyingAgentForGatewayzModel("gatewayz/claude-code/opus"),
        ).toBe("claudeCode");
        expect(
          getUnderlyingAgentForGatewayzModel("gatewayz/claude-code/sonnet"),
        ).toBe("claudeCode");
        expect(
          getUnderlyingAgentForGatewayzModel("gatewayz/claude-code/haiku"),
        ).toBe("claudeCode");
      });

      it("should return the underlying agent for Gatewayz Codex models", () => {
        expect(
          getUnderlyingAgentForGatewayzModel(
            "gatewayz/codex/gpt-5.2-codex-high",
          ),
        ).toBe("codex");
        expect(
          getUnderlyingAgentForGatewayzModel(
            "gatewayz/codex/gpt-5.1-codex-max",
          ),
        ).toBe("codex");
      });

      it("should return the underlying agent for Gatewayz Gemini models", () => {
        expect(
          getUnderlyingAgentForGatewayzModel("gatewayz/gemini/gemini-3-pro"),
        ).toBe("gemini");
        expect(
          getUnderlyingAgentForGatewayzModel("gatewayz/gemini/gemini-2.5-pro"),
        ).toBe("gemini");
      });

      it("should return the underlying agent for Gatewayz OpenCode models", () => {
        expect(
          getUnderlyingAgentForGatewayzModel("gatewayz/opencode/glm-4.7"),
        ).toBe("opencode");
        expect(
          getUnderlyingAgentForGatewayzModel("gatewayz/opencode/kimi-k2"),
        ).toBe("opencode");
      });

      it("should return null for non-Gatewayz models", () => {
        expect(getUnderlyingAgentForGatewayzModel("opus")).toBe(null);
        expect(getUnderlyingAgentForGatewayzModel("gpt-5")).toBe(null);
      });
    });

    describe("getUnderlyingModelForGatewayz", () => {
      it("should return the underlying model for Gatewayz Claude Code models", () => {
        expect(getUnderlyingModelForGatewayz("gatewayz/claude-code/opus")).toBe(
          "opus",
        );
        expect(
          getUnderlyingModelForGatewayz("gatewayz/claude-code/sonnet"),
        ).toBe("sonnet");
        expect(
          getUnderlyingModelForGatewayz("gatewayz/claude-code/haiku"),
        ).toBe("haiku");
      });

      it("should return the underlying model for Gatewayz Codex models", () => {
        expect(
          getUnderlyingModelForGatewayz("gatewayz/codex/gpt-5.2-codex-high"),
        ).toBe("gpt-5.2-codex-high");
        expect(
          getUnderlyingModelForGatewayz("gatewayz/codex/gpt-5.1-codex-max"),
        ).toBe("gpt-5.1-codex-max");
      });

      it("should return the underlying model for Gatewayz Gemini models", () => {
        expect(
          getUnderlyingModelForGatewayz("gatewayz/gemini/gemini-3-pro"),
        ).toBe("gemini-3-pro");
        expect(
          getUnderlyingModelForGatewayz("gatewayz/gemini/gemini-2.5-pro"),
        ).toBe("gemini-2.5-pro");
      });

      it("should return the underlying model for Gatewayz OpenCode models", () => {
        expect(getUnderlyingModelForGatewayz("gatewayz/opencode/glm-4.7")).toBe(
          "opencode/glm-4.7",
        );
        expect(getUnderlyingModelForGatewayz("gatewayz/opencode/kimi-k2")).toBe(
          "opencode/kimi-k2",
        );
      });

      it("should return the original model for non-Gatewayz models", () => {
        expect(getUnderlyingModelForGatewayz("opus")).toBe("opus");
        expect(getUnderlyingModelForGatewayz("gpt-5")).toBe("gpt-5");
      });
    });

    describe("modelToAgent for Gatewayz models", () => {
      it("should return gatewayz for all Gatewayz models", () => {
        expect(modelToAgent("gatewayz/claude-code/opus")).toBe("gatewayz");
        expect(modelToAgent("gatewayz/codex/gpt-5.2-codex-high")).toBe(
          "gatewayz",
        );
        expect(modelToAgent("gatewayz/gemini/gemini-3-pro")).toBe("gatewayz");
        expect(modelToAgent("gatewayz/opencode/glm-4.7")).toBe("gatewayz");
      });
    });

    describe("agentToModels for Gatewayz", () => {
      it("should return individual Gatewayz models when Code Router is disabled", () => {
        const gatewayzModels = agentToModels("gatewayz", options);
        expect(gatewayzModels).toContain("gatewayz/claude-code/opus");
        expect(gatewayzModels).toContain("gatewayz/claude-code/sonnet");
        expect(gatewayzModels).toContain("gatewayz/codex/gpt-5.2-codex-high");
        expect(gatewayzModels).toContain("gatewayz/gemini/gemini-3-pro");
        // Should NOT include Code Router models when disabled
        expect(gatewayzModels).not.toContain("gatewayz:code:balanced");
        expect(gatewayzModels).not.toContain("gatewayz:code:price");
        expect(gatewayzModels).not.toContain("gatewayz:code:performance");
      });

      it("should return only Code Router models when Code Router is enabled", () => {
        const gatewayzModels = agentToModels("gatewayz", {
          ...options,
          codeRouterSettings: { enabled: true, mode: "balanced" },
        });
        // Should include only Code Router models
        expect(gatewayzModels).toContain("gatewayz:code:balanced");
        expect(gatewayzModels).toContain("gatewayz:code:price");
        expect(gatewayzModels).toContain("gatewayz:code:performance");
        expect(gatewayzModels).toHaveLength(3);
        // Should NOT include individual models
        expect(gatewayzModels).not.toContain("gatewayz/claude-code/opus");
        expect(gatewayzModels).not.toContain("gatewayz/claude-code/sonnet");
        expect(gatewayzModels).not.toContain(
          "gatewayz/codex/gpt-5.2-codex-high",
        );
      });
    });

    describe("normalizedModelForDaemon for Gatewayz models", () => {
      it("should normalize Gatewayz Claude Code models", () => {
        expect(normalizedModelForDaemon("gatewayz/claude-code/opus")).toBe(
          "opus",
        );
        expect(normalizedModelForDaemon("gatewayz/claude-code/sonnet")).toBe(
          "sonnet",
        );
        expect(normalizedModelForDaemon("gatewayz/claude-code/haiku")).toBe(
          "haiku",
        );
      });

      it("should normalize Gatewayz Codex models", () => {
        expect(
          normalizedModelForDaemon("gatewayz/codex/gpt-5.2-codex-high"),
        ).toBe("gpt-5.2-codex-high");
        expect(
          normalizedModelForDaemon("gatewayz/codex/gpt-5.1-codex-max"),
        ).toBe("gpt-5.1-codex-max");
      });

      it("should normalize Gatewayz Gemini models", () => {
        expect(normalizedModelForDaemon("gatewayz/gemini/gemini-3-pro")).toBe(
          "gemini-3-pro-preview",
        );
        expect(normalizedModelForDaemon("gatewayz/gemini/gemini-2.5-pro")).toBe(
          "gemini-2.5-pro",
        );
      });

      it("should normalize Gatewayz OpenCode models with opencode prefix", () => {
        // OpenCode models need to keep the opencode/ prefix and be normalized to terry/
        expect(normalizedModelForDaemon("gatewayz/opencode/glm-4.7")).toBe(
          "terry/glm-4.7",
        );
        expect(normalizedModelForDaemon("gatewayz/opencode/glm-4.6")).toBe(
          "terry/glm-4.6",
        );
        expect(normalizedModelForDaemon("gatewayz/opencode/kimi-k2")).toBe(
          "terry/kimi-k2",
        );
      });
    });
  });

  describe("isConnectedCredentialsSupported", () => {
    it("should return true for agents that support connected credentials", () => {
      expect(isConnectedCredentialsSupported("claudeCode")).toBe(true);
      expect(isConnectedCredentialsSupported("codex")).toBe(true);
      expect(isConnectedCredentialsSupported("amp")).toBe(true);
      expect(isConnectedCredentialsSupported("gemini")).toBe(true);
    });

    it("should return false for agents that do not support connected credentials", () => {
      expect(isConnectedCredentialsSupported("gatewayz")).toBe(false);
      expect(isConnectedCredentialsSupported("opencode")).toBe(false);
    });
  });

  describe("Code Router utilities", () => {
    describe("isCodeRouterModel", () => {
      it("should return true for Code Router models", () => {
        expect(isCodeRouterModel("gatewayz:code:balanced")).toBe(true);
        expect(isCodeRouterModel("gatewayz:code:price")).toBe(true);
        expect(isCodeRouterModel("gatewayz:code:performance")).toBe(true);
      });

      it("should return false for non-Code Router models", () => {
        expect(isCodeRouterModel("gatewayz/claude-code/sonnet")).toBe(false);
        expect(isCodeRouterModel("opus")).toBe(false);
        expect(isCodeRouterModel("sonnet")).toBe(false);
        expect(isCodeRouterModel(null)).toBe(false);
      });
    });

    describe("getCodeRouterMode", () => {
      it("should return balanced for default Code Router model", () => {
        expect(getCodeRouterMode("gatewayz:code:balanced")).toBe("balanced");
      });

      it("should return price for price-optimized model", () => {
        expect(getCodeRouterMode("gatewayz:code:price")).toBe("price");
      });

      it("should return quality for performance-optimized model", () => {
        expect(getCodeRouterMode("gatewayz:code:performance")).toBe("quality");
      });

      it("should return balanced for non-Code Router models", () => {
        expect(getCodeRouterMode("opus")).toBe("balanced");
        expect(getCodeRouterMode(null)).toBe("balanced");
      });
    });

    describe("getCodeRouterModelForMode", () => {
      it("should return correct model for each mode", () => {
        expect(getCodeRouterModelForMode("balanced")).toBe(
          "gatewayz:code:balanced",
        );
        expect(getCodeRouterModelForMode("price")).toBe("gatewayz:code:price");
        expect(getCodeRouterModelForMode("quality")).toBe(
          "gatewayz:code:performance",
        );
      });
    });

    describe("getDefaultCodeRouterSettings", () => {
      it("should return disabled Code Router by default", () => {
        const settings = getDefaultCodeRouterSettings();
        expect(settings.enabled).toBe(false);
        expect(settings.mode).toBe("balanced");
      });
    });

    describe("getDefaultModelForAgent with Code Router", () => {
      it("should return Code Router model when enabled", () => {
        const model = getDefaultModelForAgent({
          agent: "gatewayz",
          agentVersion: "latest",
          codeRouterSettings: { enabled: true, mode: "balanced" },
        });
        expect(model).toBe("gatewayz:code:balanced");
      });

      it("should return price-optimized Code Router model when mode is price", () => {
        const model = getDefaultModelForAgent({
          agent: "gatewayz",
          agentVersion: "latest",
          codeRouterSettings: { enabled: true, mode: "price" },
        });
        expect(model).toBe("gatewayz:code:price");
      });

      it("should return performance-optimized Code Router model when mode is quality", () => {
        const model = getDefaultModelForAgent({
          agent: "gatewayz",
          agentVersion: "latest",
          codeRouterSettings: { enabled: true, mode: "quality" },
        });
        expect(model).toBe("gatewayz:code:performance");
      });

      it("should return default Gatewayz model when Code Router is disabled", () => {
        const model = getDefaultModelForAgent({
          agent: "gatewayz",
          agentVersion: "latest",
          codeRouterSettings: { enabled: false, mode: "balanced" },
        });
        expect(model).toBe("gatewayz/claude-code/sonnet");
      });

      it("should return default Gatewayz model when no Code Router settings provided", () => {
        const model = getDefaultModelForAgent({
          agent: "gatewayz",
          agentVersion: "latest",
        });
        expect(model).toBe("gatewayz/claude-code/sonnet");
      });
    });

    describe("modelToAgent for Code Router models", () => {
      it("should return gatewayz for Code Router models", () => {
        expect(modelToAgent("gatewayz:code:balanced")).toBe("gatewayz");
        expect(modelToAgent("gatewayz:code:price")).toBe("gatewayz");
        expect(modelToAgent("gatewayz:code:performance")).toBe("gatewayz");
      });
    });

    describe("agentToModels Code Router filtering", () => {
      it("should include Code Router models only when enabled", () => {
        // With Code Router enabled
        const gatewayzModelsWithRouter = agentToModels("gatewayz", {
          ...options,
          codeRouterSettings: { enabled: true, mode: "balanced" },
        });
        expect(gatewayzModelsWithRouter).toContain("gatewayz:code:balanced");
        expect(gatewayzModelsWithRouter).toContain("gatewayz:code:price");
        expect(gatewayzModelsWithRouter).toContain("gatewayz:code:performance");
        expect(gatewayzModelsWithRouter).toHaveLength(3);

        // Without Code Router
        const gatewayzModelsWithoutRouter = agentToModels("gatewayz", options);
        expect(gatewayzModelsWithoutRouter).not.toContain(
          "gatewayz:code:balanced",
        );
        expect(gatewayzModelsWithoutRouter).not.toContain(
          "gatewayz:code:price",
        );
        expect(gatewayzModelsWithoutRouter).not.toContain(
          "gatewayz:code:performance",
        );
      });
    });

    describe("isPlanModeSupported for Code Router models", () => {
      it("should return true for Code Router models", () => {
        expect(isPlanModeSupported("gatewayz:code:balanced")).toBe(true);
        expect(isPlanModeSupported("gatewayz:code:price")).toBe(true);
        expect(isPlanModeSupported("gatewayz:code:performance")).toBe(true);
      });
    });

    describe("isImageUploadSupported for Code Router models", () => {
      it("should return true for Code Router models", () => {
        expect(isImageUploadSupported("gatewayz:code:balanced")).toBe(true);
        expect(isImageUploadSupported("gatewayz:code:price")).toBe(true);
        expect(isImageUploadSupported("gatewayz:code:performance")).toBe(true);
      });
    });
  });
});
