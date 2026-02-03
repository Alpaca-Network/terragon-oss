import type { RegistrySearchResult, McpServerType } from "./types";

/**
 * Transform Official MCP Registry API response to our format
 */
export function transformOfficialRegistryResponse(
  data: OfficialRegistryResponse,
): RegistrySearchResult[] {
  if (!data.servers || !Array.isArray(data.servers)) {
    return [];
  }

  return data.servers.map((server): RegistrySearchResult => {
    // Determine server type from package info
    let serverType: McpServerType = "command";
    if (server.connections?.http || server.connections?.streamable_http) {
      serverType = "http";
    } else if (server.connections?.sse) {
      serverType = "sse";
    }

    return {
      id: `official-${server.name}`,
      name: server.name,
      qualifiedName: server.qualified_name || server.name,
      displayName: server.display_name || server.name,
      description: server.description || "No description available",
      iconUrl: server.icon_url,
      source: "official",
      serverType,
      connectionConfig: {
        command: server.package?.name ? "npx" : undefined,
        args: server.package?.name ? ["-y", server.package.name] : undefined,
        url: server.connections?.http?.url || server.connections?.sse?.url,
      },
      lastUpdated: server.updated_at,
      verified: server.verified,
      tools: server.tools?.map((t) => ({
        name: t.name,
        description: t.description || "",
      })),
      homepage: server.homepage,
    };
  });
}

/**
 * Transform Smithery Registry API response to our format
 */
export function transformSmitheryRegistryResponse(
  data: SmitheryRegistryResponse,
): RegistrySearchResult[] {
  if (!data.servers || !Array.isArray(data.servers)) {
    return [];
  }

  return data.servers.map((server): RegistrySearchResult => {
    // Smithery primarily hosts HTTP/WebSocket servers
    const serverType: McpServerType =
      server.transport === "sse" ? "sse" : "http";

    return {
      id: `smithery-${server.qualifiedName || server.name}`,
      name: server.name,
      qualifiedName: server.qualifiedName || server.name,
      displayName: server.displayName || server.name,
      description: server.description || "No description available",
      iconUrl: server.iconUrl,
      source: "smithery",
      serverType,
      connectionConfig: {
        url: server.url || server.deploymentUrl,
      },
      lastUpdated: server.updatedAt,
      verified: server.verified,
      tools: server.tools?.map((t) => ({
        name: t.name,
        description: t.description || "",
      })),
      homepage: server.homepage || server.repository,
    };
  });
}

// Type definitions for API responses

interface OfficialRegistryServer {
  name: string;
  qualified_name?: string;
  display_name?: string;
  description?: string;
  icon_url?: string;
  verified?: boolean;
  updated_at?: string;
  homepage?: string;
  package?: {
    name: string;
    version?: string;
    registry?: string;
  };
  connections?: {
    stdio?: {
      command: string;
      args?: string[];
    };
    http?: {
      url: string;
    };
    streamable_http?: {
      url: string;
    };
    sse?: {
      url: string;
    };
  };
  tools?: Array<{
    name: string;
    description?: string;
  }>;
}

interface OfficialRegistryResponse {
  servers: OfficialRegistryServer[];
  total?: number;
  page?: number;
  page_size?: number;
}

interface SmitheryRegistryServer {
  name: string;
  qualifiedName?: string;
  displayName?: string;
  description?: string;
  iconUrl?: string;
  verified?: boolean;
  updatedAt?: string;
  homepage?: string;
  repository?: string;
  url?: string;
  deploymentUrl?: string;
  transport?: "http" | "sse" | "ws";
  tools?: Array<{
    name: string;
    description?: string;
  }>;
}

interface SmitheryRegistryResponse {
  servers: SmitheryRegistryServer[];
  total?: number;
  page?: number;
  pageSize?: number;
}
