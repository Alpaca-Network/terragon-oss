// MCP Server transport types
export type McpServerType = "command" | "http" | "sse";

// Credential field definition for dynamic form generation
export interface CredentialFieldDefinition {
  name: string; // Field identifier (e.g., "apiKey", "token")
  label: string; // UI display label
  type: "text" | "password" | "url";
  placeholder?: string;
  required: boolean;
  description?: string;
  helpUrl?: string; // Link to get the credential
  helpText?: string; // Additional help text
  envVarName: string; // Environment variable name in MCP config
}

// Category for organizing curated servers
export type McpServerCategory =
  | "coding"
  | "database"
  | "search"
  | "utility"
  | "ai";

export const MCP_SERVER_CATEGORY_LABELS: Record<McpServerCategory, string> = {
  coding: "Coding & Development",
  database: "Databases",
  search: "Search & Web",
  utility: "Utilities",
  ai: "AI & Memory",
};

// Curated MCP server definition
export interface CuratedMcpServer {
  id: string;
  name: string; // Default key name in mcpServers
  displayName: string;
  description: string;
  iconName: string; // Lucide icon name
  category: McpServerCategory;
  serverType: McpServerType;

  // Configuration template
  configTemplate: {
    // For command-based servers
    command?: string;
    args?: string[];
    // For HTTP/SSE servers
    url?: string;
    headers?: Record<string, string>;
  };

  // Credentials required (empty array if none)
  credentialFields: CredentialFieldDefinition[];

  // Documentation
  docsUrl?: string;
  setupInstructions?: string;
}

// Registry search result from external APIs
export interface RegistrySearchResult {
  id: string;
  name: string;
  qualifiedName: string; // owner/repo or unique identifier
  displayName: string;
  description: string;
  iconUrl?: string;
  source: "smithery" | "official";

  // Connection info
  serverType: McpServerType;
  connectionConfig?: {
    url?: string;
    command?: string;
    args?: string[];
  };

  // Metadata
  lastUpdated?: string;
  verified?: boolean;
  tools?: Array<{ name: string; description: string }>;
  homepage?: string;
}

// Combined search results
export interface RegistrySearchResults {
  official: RegistrySearchResult[];
  smithery: RegistrySearchResult[];
  errors: string[];
}

// Server configuration state during editing
export interface McpServerConfigState {
  serverKey: string; // Key in mcpServers object
  serverType: McpServerType;
  source: "curated" | "registry" | "manual";

  // Command-based config
  command?: string;
  args?: string[];

  // HTTP/SSE config
  url?: string;
  headers?: Record<string, string>;

  // Environment variables (credentials)
  env?: Record<string, string>;
}

// Props for the configure dialog
export interface ConfigureServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: CuratedMcpServer | RegistrySearchResult | null;
  existingServerKeys: string[];
  onAdd: (serverKey: string, config: McpServerConfigState) => void;
}

// Props for the browse dialog
export interface BrowseServersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingServerKeys: string[];
  onAddServer: (serverKey: string, config: McpServerConfigState) => void;
}
