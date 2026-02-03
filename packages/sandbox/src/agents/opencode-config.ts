import { AIModel } from "@terragon/agent/types";
import { McpConfig } from "../mcp-config";
import { agentToModels, getModelDisplayName } from "@terragon/agent/utils";

export function getModelId(modelName: AIModel): string {
  switch (modelName) {
    case "opencode/grok-code":
      return "grok-code-fast-1";
    case "opencode/qwen3-coder":
      return "qwen3-coder";
    case "opencode/kimi-k2":
      return "kimi-k2";
    case "opencode/glm-4.6":
      return "glm-4.6";
    case "opencode/glm-4.7":
      return "glm-4.7";
    case "opencode/glm-4.7-flash":
      return "glm-4.7-flash";
    case "opencode/glm-4.7-lite":
      return "glm-4.7-lite";
    case "opencode/gemini-2.5-pro":
      return "gemini-2.5-pro";
    case "opencode/gemini-3-pro":
      return "gemini-3-pro";
    case "opencode-oai/gpt-5":
      return "gpt-5";
    case "opencode-oai/gpt-5-codex":
      return "gpt-5-codex";
    case "opencode-ant/sonnet":
      return "claude-sonnet-4-5";
    default:
      throw new Error(`Unknown model: ${modelName}`);
  }
}

// https://opencode.ai/docs/config/
export function buildOpencodeConfig({
  publicUrl,
  userMcpConfig,
}: {
  publicUrl: string;
  userMcpConfig: McpConfig | undefined;
}): string {
  const mcp: Record<string, any> = {};
  for (const [name, server] of Object.entries(
    userMcpConfig?.mcpServers ?? {},
  )) {
    if ("command" in server) {
      mcp[name] = {
        type: "local",
        command: [server.command, ...(server.args ?? [])],
        enabled: true,
        environment: server.env,
      };
    } else if ("url" in server) {
      mcp[name] = {
        type: "remote",
        url: server.url,
        enabled: true,
        headers: server.headers,
      };
    }
  }

  const gatewayzModels = Object.fromEntries(
    agentToModels("opencode", {
      agentVersion: "latest",
      // For the config, just include all available models
      enableOpenRouterOpenAIAnthropicModel: true,
      enableOpencodeGemini3ProModelOption: true,
    })
      .filter(
        (model) =>
          model.startsWith("opencode/") ||
          model.startsWith("opencode-oai/") ||
          model.startsWith("opencode-ant/"),
      )
      .map((model) => {
        const displayName = getModelDisplayName(model);
        const modelName = model.split("/")[1]!;
        return [
          modelName,
          {
            id: getModelId(model),
            name: displayName.fullName,
          },
        ];
      }),
  );

  const config = {
    $schema: "https://opencode.ai/config.json",
    autoupdate: false,
    mcp,
    provider: {
      terry: {
        npm: "@ai-sdk/openai-compatible",
        name: "Terragon",
        options: {
          baseURL: `${publicUrl}/api/proxy/gatewayz/v1`,
          headers: { "X-Daemon-Token": "{env:DAEMON_TOKEN}" },
        },
        models: gatewayzModels,
      },
      "terry-google": {
        npm: "@ai-sdk/google",
        name: "Terragon Google",
        options: {
          baseURL: `${publicUrl}/api/proxy/google/v1`,
          apiKey: "unused",
          headers: {
            "X-Daemon-Token": "{env:DAEMON_TOKEN}",
          },
        },
        models: {
          "gemini-2.5-pro": {
            id: "gemini-2.5-pro",
            name: "Gemini 2.5 Pro",
          },
          "gemini-3-pro": {
            id: "gemini-3-pro-preview",
            name: "Gemini 3 Pro",
          },
        },
      },
      "terry-ant": {
        npm: "@ai-sdk/anthropic",
        name: "Terragon Anthropic",
        options: {
          baseURL: `${publicUrl}/api/proxy/anthropic/v1`,
          apiKey: "unused",
          headers: { "X-Daemon-Token": "{env:DAEMON_TOKEN}" },
        },
        models: {
          sonnet: {
            id: "claude-sonnet-4-5",
            name: "Claude Sonnet 4.5",
          },
        },
      },
      "terry-oai": {
        npm: "@ai-sdk/openai",
        name: "Terragon OpenAI",
        options: {
          baseURL: `${publicUrl}/api/proxy/openai/v1`,
          apiKey: "unused",
          headers: { "X-Daemon-Token": "{env:DAEMON_TOKEN}" },
        },
        models: {
          "gpt-5": {
            id: "gpt-5",
            name: "GPT-5",
          },
          "gpt-5-codex": {
            id: "gpt-5-codex",
            name: "GPT-5-Codex",
          },
        },
      },
    },
  };
  return JSON.stringify(config, null, 2);
}

export const OPENCODE_AUTO_APPROVE_PLUGIN_CONTENT = `\
import { Plugin } from "@opencode-ai/plugin";

export default (async (ctx) => {
  return {
    "permission.ask": async (input, output) => {
      output.status = "allow";
    },
  };
}) satisfies Plugin;`;
