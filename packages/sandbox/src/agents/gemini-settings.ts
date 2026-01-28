import { McpConfig } from "../mcp-config";

// https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/configuration.md#mcpservers
type GeminiMcpServer = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  httpUrl?: string;
  headers?: Record<string, string>;
};

// Gemini CLI auth types
// - "gemini-api-key": Uses GEMINI_API_KEY environment variable
// - "google-cloud-oauth": Uses Google OAuth access token via GOOGLE_APPLICATION_CREDENTIALS
export type GeminiAuthType = "gemini-api-key" | "google-cloud-oauth";

export function buildGeminiSettings({
  userMcpConfig,
  authType = "gemini-api-key",
}: {
  userMcpConfig: McpConfig | undefined;
  authType?: GeminiAuthType;
}): string {
  const mcpServers: Record<string, GeminiMcpServer> = {};
  for (const [name, server] of Object.entries(
    userMcpConfig?.mcpServers ?? {},
  )) {
    if ("command" in server) {
      mcpServers[name] = {
        command: server.command,
        args: server.args,
        env: server.env,
      };
    } else if (server.type === "http") {
      mcpServers[name] = {
        httpUrl: server.url,
        headers: server.headers,
        env: server.env,
      };
    } else if (server.type === "sse") {
      mcpServers[name] = {
        url: server.url,
        headers: server.headers,
        env: server.env,
      };
    }
  }
  return JSON.stringify(
    {
      security: {
        auth: {
          selectedType: authType,
        },
      },
      ui: {
        theme: "Default",
      },
      general: {
        previewFeatures: true,
      },
      mcpServers,
    },
    null,
    2,
  );
}
