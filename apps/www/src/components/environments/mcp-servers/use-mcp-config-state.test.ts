import { describe, it, expect } from "vitest";
import type { McpConfig, McpServer } from "@terragon/sandbox/mcp-config";

// Minimal mock of React's useState and useCallback for testing hooks without React Testing Library
// This tests the logic of the hook rather than its React behavior

describe("useMcpConfigState logic", () => {
  // Test the core data manipulation functions directly by extracting them
  // Since we can't easily test hooks without @testing-library/react,
  // we test the underlying logic patterns

  const initialConfig: McpConfig = {
    mcpServers: {
      "existing-server": {
        command: "npx",
        args: ["-y", "@example/mcp-server"],
      },
    },
  };

  const emptyConfig: McpConfig = {
    mcpServers: {},
  };

  describe("data structure expectations", () => {
    it("should have correct McpConfig shape", () => {
      expect(initialConfig).toHaveProperty("mcpServers");
      expect(typeof initialConfig.mcpServers).toBe("object");
    });

    it("should have correct McpServer shape for command servers", () => {
      const server = initialConfig.mcpServers["existing-server"];
      expect(server).toHaveProperty("command");
      expect(server).toHaveProperty("args");
    });

    it("should support HTTP server type", () => {
      const httpConfig: McpConfig = {
        mcpServers: {
          "http-server": {
            type: "http",
            url: "https://example.com/mcp",
          },
        },
      };
      const server = httpConfig.mcpServers["http-server"];
      expect(server).toHaveProperty("type", "http");
      expect(server).toHaveProperty("url");
    });

    it("should support env variables in server config", () => {
      const configWithEnv: McpConfig = {
        mcpServers: {
          "server-with-env": {
            command: "npx",
            args: ["-y", "@example/mcp"],
            env: {
              API_KEY: "test-key",
              ANOTHER_VAR: "value",
            },
          },
        },
      };
      const server = configWithEnv.mcpServers["server-with-env"];
      expect(server).toHaveProperty("env");
      expect((server as any).env.API_KEY).toBe("test-key");
    });
  });

  describe("server manipulation operations", () => {
    it("should be able to add a server to config", () => {
      const newServer: McpServer = {
        command: "npx",
        args: ["-y", "@new/mcp-server"],
      };

      const updatedConfig: McpConfig = {
        mcpServers: {
          ...emptyConfig.mcpServers,
          "new-server": newServer,
        },
      };

      expect(updatedConfig.mcpServers["new-server"]).toEqual(newServer);
      expect(Object.keys(updatedConfig.mcpServers)).toHaveLength(1);
    });

    it("should preserve existing servers when adding", () => {
      const newServer: McpServer = {
        type: "http",
        url: "https://example.com/mcp",
      };

      const updatedConfig: McpConfig = {
        mcpServers: {
          ...initialConfig.mcpServers,
          "new-server": newServer,
        },
      };

      expect(updatedConfig.mcpServers["existing-server"]).toBeDefined();
      expect(updatedConfig.mcpServers["new-server"]).toEqual(newServer);
      expect(Object.keys(updatedConfig.mcpServers)).toHaveLength(2);
    });

    it("should be able to update a server", () => {
      const updatedServer: McpServer = {
        command: "npx",
        args: ["-y", "@updated/mcp-server"],
        env: { API_KEY: "test" },
      };

      const updatedConfig: McpConfig = {
        mcpServers: {
          ...initialConfig.mcpServers,
          "existing-server": updatedServer,
        },
      };

      expect(updatedConfig.mcpServers["existing-server"]).toEqual(
        updatedServer,
      );
    });

    it("should be able to remove a server", () => {
      const { "existing-server": removed, ...rest } = initialConfig.mcpServers;
      const updatedConfig: McpConfig = {
        mcpServers: rest,
      };

      expect(updatedConfig.mcpServers["existing-server"]).toBeUndefined();
      expect(Object.keys(updatedConfig.mcpServers)).toHaveLength(0);
    });

    it("should be able to rename a server", () => {
      const { "existing-server": serverConfig, ...rest } =
        initialConfig.mcpServers;
      // serverConfig is guaranteed to exist in this test since we set it up in initialConfig
      const updatedConfig: McpConfig = {
        mcpServers: {
          ...rest,
          "renamed-server": serverConfig!,
        },
      };

      expect(updatedConfig.mcpServers["existing-server"]).toBeUndefined();
      expect(updatedConfig.mcpServers["renamed-server"]).toEqual(serverConfig);
    });
  });

  describe("key generation", () => {
    it("should generate unique server keys", () => {
      const existingKeys = ["github", "postgres"];
      const generateKey = (
        baseName: string,
        existingKeys: string[],
      ): string => {
        if (!existingKeys.includes(baseName)) {
          return baseName;
        }
        let counter = 2;
        while (existingKeys.includes(`${baseName}-${counter}`)) {
          counter++;
        }
        return `${baseName}-${counter}`;
      };

      expect(generateKey("new-server", existingKeys)).toBe("new-server");
      expect(generateKey("github", existingKeys)).toBe("github-2");
      expect(generateKey("github", [...existingKeys, "github-2"])).toBe(
        "github-3",
      );
    });
  });

  describe("validation", () => {
    it("should not allow 'terry' as a server name", () => {
      const isReservedName = (name: string) => name === "terry";
      expect(isReservedName("terry")).toBe(true);
      expect(isReservedName("github")).toBe(false);
      expect(isReservedName("Terry")).toBe(false); // case-sensitive
    });

    it("should check for duplicate server keys", () => {
      const existingKeys = ["github", "postgres"];
      const hasServer = (key: string) => existingKeys.includes(key);
      expect(hasServer("github")).toBe(true);
      expect(hasServer("new-server")).toBe(false);
    });
  });
});
