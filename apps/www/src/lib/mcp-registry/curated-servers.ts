import type { CuratedMcpServer } from "./types";

/**
 * Curated list of MCP servers recommended for coding workflows.
 * These are pre-configured with sensible defaults and credential requirements.
 */
export const CURATED_MCP_SERVERS: CuratedMcpServer[] = [
  // Coding & Development
  {
    id: "github",
    name: "github",
    displayName: "GitHub",
    description:
      "Interact with GitHub repositories, issues, pull requests, and more",
    iconName: "Github",
    category: "coding",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
    },
    credentialFields: [
      {
        name: "githubToken",
        label: "GitHub Personal Access Token",
        type: "password",
        placeholder: "ghp_xxxxxxxxxxxx",
        required: true,
        description: "Token with repo access for interacting with repositories",
        helpUrl: "https://github.com/settings/tokens",
        helpText: "Create a token with 'repo' scope",
        envVarName: "GITHUB_PERSONAL_ACCESS_TOKEN",
      },
    ],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
  },
  {
    id: "gitlab",
    name: "gitlab",
    displayName: "GitLab",
    description: "Interact with GitLab projects, issues, and merge requests",
    iconName: "GitBranch",
    category: "coding",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-gitlab"],
    },
    credentialFields: [
      {
        name: "gitlabToken",
        label: "GitLab Personal Access Token",
        type: "password",
        placeholder: "glpat-xxxxxxxxxxxx",
        required: true,
        description: "Token with API access for interacting with GitLab",
        helpUrl: "https://gitlab.com/-/user_settings/personal_access_tokens",
        helpText: "Create a token with 'api' scope",
        envVarName: "GITLAB_PERSONAL_ACCESS_TOKEN",
      },
    ],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab",
  },
  {
    id: "linear",
    name: "linear",
    displayName: "Linear",
    description: "Manage Linear issues, projects, and workflows",
    iconName: "LayoutList",
    category: "coding",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-linear"],
    },
    credentialFields: [
      {
        name: "linearApiKey",
        label: "Linear API Key",
        type: "password",
        placeholder: "lin_api_xxxxxxxxxxxx",
        required: true,
        description: "API key for Linear access",
        helpUrl: "https://linear.app/settings/api",
        helpText: "Create a personal API key in Linear settings",
        envVarName: "LINEAR_API_KEY",
      },
    ],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/linear",
  },
  {
    id: "sentry",
    name: "sentry",
    displayName: "Sentry",
    description: "Access Sentry error tracking and performance monitoring",
    iconName: "Bug",
    category: "coding",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sentry"],
    },
    credentialFields: [
      {
        name: "sentryToken",
        label: "Sentry Auth Token",
        type: "password",
        placeholder: "sntrys_xxxxxxxxxxxx",
        required: true,
        description: "Auth token for Sentry API access",
        helpUrl: "https://sentry.io/settings/account/api/auth-tokens/",
        helpText: "Create an auth token with appropriate scopes",
        envVarName: "SENTRY_AUTH_TOKEN",
      },
    ],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/sentry",
  },

  // Databases
  {
    id: "postgres",
    name: "postgres",
    displayName: "PostgreSQL",
    description: "Query and manage PostgreSQL databases",
    iconName: "Database",
    category: "database",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres"],
    },
    credentialFields: [
      {
        name: "connectionString",
        label: "Connection String",
        type: "password",
        placeholder: "postgresql://user:password@host:5432/database",
        required: true,
        description: "PostgreSQL connection URI",
        envVarName: "POSTGRES_URL",
      },
    ],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
  },
  {
    id: "sqlite",
    name: "sqlite",
    displayName: "SQLite",
    description: "Query and manage SQLite databases",
    iconName: "Database",
    category: "database",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sqlite"],
    },
    credentialFields: [
      {
        name: "dbPath",
        label: "Database Path",
        type: "text",
        placeholder: "/path/to/database.db",
        required: true,
        description: "Path to the SQLite database file",
        envVarName: "SQLITE_DB_PATH",
      },
    ],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
  },

  // Search & Web
  {
    id: "brave-search",
    name: "brave-search",
    displayName: "Brave Search",
    description: "Web search powered by Brave Search API",
    iconName: "Search",
    category: "search",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
    },
    credentialFields: [
      {
        name: "apiKey",
        label: "Brave Search API Key",
        type: "password",
        placeholder: "BSA...",
        required: true,
        description: "API key for Brave Search",
        helpUrl: "https://api.search.brave.com/",
        helpText: "Sign up for a Brave Search API key",
        envVarName: "BRAVE_API_KEY",
      },
    ],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
  },
  {
    id: "fetch",
    name: "fetch",
    displayName: "Web Fetch",
    description: "Fetch and process content from web URLs",
    iconName: "Globe",
    category: "search",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-fetch"],
    },
    credentialFields: [],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
  },
  {
    id: "context7",
    name: "context7",
    displayName: "Context7",
    description:
      "Up-to-date documentation for popular libraries and frameworks",
    iconName: "BookOpen",
    category: "search",
    serverType: "http",
    configTemplate: {
      url: "https://mcp.context7.com/mcp",
    },
    credentialFields: [],
    docsUrl: "https://context7.com/",
  },

  // Utilities
  {
    id: "filesystem",
    name: "filesystem",
    displayName: "Filesystem",
    description: "Read and write files on the local filesystem",
    iconName: "Folder",
    category: "utility",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    },
    credentialFields: [],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    setupInstructions:
      "Edit the args to specify allowed directories (e.g., /home/user/projects)",
  },
  {
    id: "time",
    name: "time",
    displayName: "Time",
    description: "Get current time and timezone information",
    iconName: "Clock",
    category: "utility",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-time"],
    },
    credentialFields: [],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/time",
  },

  // AI & Memory
  {
    id: "memory",
    name: "memory",
    displayName: "Memory",
    description: "Persistent memory using a knowledge graph",
    iconName: "Brain",
    category: "ai",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
    },
    credentialFields: [],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
  },
  {
    id: "sequential-thinking",
    name: "sequential-thinking",
    displayName: "Sequential Thinking",
    description: "Step-by-step reasoning and problem solving",
    iconName: "ListOrdered",
    category: "ai",
    serverType: "command",
    configTemplate: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    },
    credentialFields: [],
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
  },
];

/**
 * Get curated servers grouped by category
 */
export function getCuratedServersByCategory(): Record<
  string,
  CuratedMcpServer[]
> {
  const grouped: Record<string, CuratedMcpServer[]> = {};

  for (const server of CURATED_MCP_SERVERS) {
    const category = server.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category]!.push(server);
  }

  return grouped;
}

/**
 * Find a curated server by ID
 */
export function findCuratedServer(id: string): CuratedMcpServer | undefined {
  return CURATED_MCP_SERVERS.find((s) => s.id === id);
}
