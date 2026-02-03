"use client";

import * as Icons from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getCuratedServersByCategory,
  MCP_SERVER_CATEGORY_LABELS,
  type CuratedMcpServer,
  type McpServerCategory,
} from "@/lib/mcp-registry";

interface RecommendedServersTabProps {
  onSelectServer: (server: CuratedMcpServer) => void;
  existingServerKeys: string[];
}

function ServerCard({
  server,
  onSelect,
  isAdded,
}: {
  server: CuratedMcpServer;
  onSelect: () => void;
  isAdded: boolean;
}) {
  const IconComponent = (Icons as unknown as Record<string, Icons.LucideIcon>)[
    server.iconName
  ];

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isAdded}
      className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed w-full"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        {IconComponent ? (
          <IconComponent className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Icons.Terminal className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{server.displayName}</span>
          {isAdded && (
            <Badge variant="secondary" className="text-xs">
              Added
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {server.description}
        </p>
      </div>
    </button>
  );
}

export function RecommendedServersTab({
  onSelectServer,
  existingServerKeys,
}: RecommendedServersTabProps) {
  const serversByCategory = getCuratedServersByCategory();

  // Order categories for display
  const categoryOrder: McpServerCategory[] = [
    "coding",
    "database",
    "search",
    "utility",
    "ai",
  ];

  return (
    <div className="space-y-6">
      {categoryOrder.map((category) => {
        const servers = serversByCategory[category];
        if (!servers || servers.length === 0) return null;

        return (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {MCP_SERVER_CATEGORY_LABELS[category]}
            </h3>
            <div className="grid gap-2">
              {servers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  onSelect={() => onSelectServer(server)}
                  isAdded={existingServerKeys.includes(server.name)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
