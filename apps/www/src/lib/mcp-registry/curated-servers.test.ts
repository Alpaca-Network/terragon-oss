import { describe, it, expect } from "vitest";
import {
  CURATED_MCP_SERVERS,
  getCuratedServersByCategory,
  findCuratedServer,
} from "./curated-servers";
import type { CuratedMcpServer } from "./types";

describe("curated-servers", () => {
  describe("CURATED_MCP_SERVERS", () => {
    it("should have at least one server", () => {
      expect(CURATED_MCP_SERVERS.length).toBeGreaterThan(0);
    });

    it("should have unique IDs for all servers", () => {
      const ids = CURATED_MCP_SERVERS.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have unique names for all servers", () => {
      const names = CURATED_MCP_SERVERS.map((s) => s.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("should have valid server types", () => {
      const validTypes = ["command", "http", "sse"];
      for (const server of CURATED_MCP_SERVERS) {
        expect(validTypes).toContain(server.serverType);
      }
    });

    it("should have required fields for all servers", () => {
      for (const server of CURATED_MCP_SERVERS) {
        expect(server.id).toBeTruthy();
        expect(server.name).toBeTruthy();
        expect(server.displayName).toBeTruthy();
        expect(server.description).toBeTruthy();
        expect(server.iconName).toBeTruthy();
        expect(server.category).toBeTruthy();
        expect(server.serverType).toBeTruthy();
        expect(server.configTemplate).toBeDefined();
        expect(server.credentialFields).toBeInstanceOf(Array);
      }
    });

    it("should have valid config templates for command-based servers", () => {
      const commandServers = CURATED_MCP_SERVERS.filter(
        (s) => s.serverType === "command",
      );
      for (const server of commandServers) {
        expect(server.configTemplate.command).toBeTruthy();
      }
    });

    it("should have valid config templates for HTTP/SSE servers", () => {
      const httpServers = CURATED_MCP_SERVERS.filter(
        (s) => s.serverType === "http" || s.serverType === "sse",
      );
      for (const server of httpServers) {
        expect(server.configTemplate.url).toBeTruthy();
      }
    });

    it("should have valid credential fields", () => {
      for (const server of CURATED_MCP_SERVERS) {
        for (const field of server.credentialFields) {
          expect(field.name).toBeTruthy();
          expect(field.label).toBeTruthy();
          expect(["text", "password", "url"]).toContain(field.type);
          expect(typeof field.required).toBe("boolean");
          expect(field.envVarName).toBeTruthy();
        }
      }
    });

    it("should not have a server named 'terry' (reserved)", () => {
      const terryServer = CURATED_MCP_SERVERS.find(
        (s) => s.name === "terry" || s.id === "terry",
      );
      expect(terryServer).toBeUndefined();
    });
  });

  describe("getCuratedServersByCategory", () => {
    it("should group servers by category", () => {
      const grouped = getCuratedServersByCategory();

      // Check that all categories have at least one server
      const allCategories = new Set(CURATED_MCP_SERVERS.map((s) => s.category));
      for (const category of allCategories) {
        expect(grouped[category]).toBeDefined();
        expect(grouped[category]!.length).toBeGreaterThan(0);
      }
    });

    it("should include all servers", () => {
      const grouped = getCuratedServersByCategory();
      const totalServers = Object.values(grouped).reduce(
        (sum, servers) => sum + servers.length,
        0,
      );
      expect(totalServers).toBe(CURATED_MCP_SERVERS.length);
    });

    it("should assign each server to the correct category", () => {
      const grouped = getCuratedServersByCategory();
      for (const [category, servers] of Object.entries(grouped)) {
        for (const server of servers) {
          expect(server.category).toBe(category);
        }
      }
    });
  });

  describe("findCuratedServer", () => {
    it("should find a server by ID", () => {
      const server = findCuratedServer("github");
      expect(server).toBeDefined();
      expect(server?.id).toBe("github");
      expect(server?.displayName).toBe("GitHub");
    });

    it("should return undefined for non-existent ID", () => {
      const server = findCuratedServer("non-existent-server");
      expect(server).toBeUndefined();
    });

    it("should find all curated servers by their IDs", () => {
      for (const curatedServer of CURATED_MCP_SERVERS) {
        const found = findCuratedServer(curatedServer.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(curatedServer.id);
      }
    });
  });
});
