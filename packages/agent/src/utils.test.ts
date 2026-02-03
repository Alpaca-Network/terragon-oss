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
      it("should return all Gatewayz models", () => {
        const gatewayzModels = agentToModels("gatewayz", options);
        expect(gatewayzModels).toContain("gatewayz/claude-code/opus");
        expect(gatewayzModels).toContain("gatewayz/claude-code/sonnet");
        expect(gatewayzModels).toContain("gatewayz/codex/gpt-5.2-codex-high");
        expect(gatewayzModels).toContain("gatewayz/gemini/gemini-3-pro");
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
});
