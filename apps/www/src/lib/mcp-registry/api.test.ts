import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  searchOfficialRegistry,
  searchSmitheryRegistry,
  searchAllRegistries,
  searchRegistriesCombined,
  clearRegistryCache,
} from "./api";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("mcp-registry/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRegistryCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("searchOfficialRegistry", () => {
    it("should search the official registry and transform results", async () => {
      const mockResponse = {
        servers: [
          {
            name: "test-server",
            qualified_name: "test/test-server",
            display_name: "Test Server",
            description: "A test server",
            verified: true,
            package: {
              name: "@test/mcp-server",
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const results = await searchOfficialRegistry("test");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("registry.modelcontextprotocol.io"),
        expect.any(Object),
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: "official-test-server",
        name: "test-server",
        displayName: "Test Server",
        source: "official",
        verified: true,
      });
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(searchOfficialRegistry("test")).rejects.toThrow(
        "Official MCP Registry returned 500",
      );
    });

    it("should cache results", async () => {
      const mockResponse = {
        servers: [{ name: "cached-server", display_name: "Cached" }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // First call
      await searchOfficialRegistry("cache-test");
      // Second call with same query
      await searchOfficialRegistry("cache-test");

      // Should only fetch once due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("searchSmitheryRegistry", () => {
    it("should search the Smithery registry and transform results", async () => {
      const mockResponse = {
        servers: [
          {
            name: "smithery-server",
            qualifiedName: "user/smithery-server",
            displayName: "Smithery Server",
            description: "A Smithery server",
            url: "https://example.com/mcp",
            transport: "http",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const results = await searchSmitheryRegistry("test");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("registry.smithery.ai"),
        expect.any(Object),
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: "smithery-user/smithery-server",
        name: "smithery-server",
        displayName: "Smithery Server",
        source: "smithery",
        serverType: "http",
      });
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(searchSmitheryRegistry("test")).rejects.toThrow(
        "Smithery Registry returned 404",
      );
    });
  });

  describe("searchAllRegistries", () => {
    it("should search both registries concurrently", async () => {
      const officialResponse = {
        servers: [{ name: "official-server", display_name: "Official" }],
      };
      const smitheryResponse = {
        servers: [{ name: "smithery-server", displayName: "Smithery" }],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(officialResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(smitheryResponse),
        });

      const results = await searchAllRegistries("test");

      expect(results.official).toHaveLength(1);
      expect(results.smithery).toHaveLength(1);
      expect(results.errors).toHaveLength(0);
    });

    it("should handle partial failures gracefully", async () => {
      const officialResponse = {
        servers: [{ name: "official-server", display_name: "Official" }],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(officialResponse),
        })
        .mockRejectedValueOnce(new Error("Network error"));

      const results = await searchAllRegistries("test");

      expect(results.official).toHaveLength(1);
      expect(results.smithery).toHaveLength(0);
      expect(results.errors).toContain("Smithery Registry unavailable");
    });

    it("should handle both registries failing", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Official error"))
        .mockRejectedValueOnce(new Error("Smithery error"));

      const results = await searchAllRegistries("test");

      expect(results.official).toHaveLength(0);
      expect(results.smithery).toHaveLength(0);
      expect(results.errors).toHaveLength(2);
    });
  });

  describe("searchRegistriesCombined", () => {
    it("should combine and deduplicate results", async () => {
      const officialResponse = {
        servers: [
          { name: "shared-server", display_name: "Shared (Official)" },
          { name: "official-only", display_name: "Official Only" },
        ],
      };
      const smitheryResponse = {
        servers: [
          { name: "shared-server", displayName: "Shared (Smithery)" },
          { name: "smithery-only", displayName: "Smithery Only" },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(officialResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(smitheryResponse),
        });

      const { results, errors } = await searchRegistriesCombined("test");

      // Should have 3 unique servers (deduped by name)
      expect(results).toHaveLength(3);
      expect(errors).toHaveLength(0);

      // Official results should be preferred for duplicates
      const sharedServer = results.find((r) => r.name === "shared-server");
      expect(sharedServer?.source).toBe("official");
    });
  });

  describe("clearRegistryCache", () => {
    it("should clear the cache", async () => {
      const mockResponse = { servers: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // First call
      await searchOfficialRegistry("test");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      clearRegistryCache();

      // Second call should fetch again
      await searchOfficialRegistry("test");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
