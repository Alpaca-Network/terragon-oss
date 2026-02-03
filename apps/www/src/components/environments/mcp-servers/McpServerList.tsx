"use client";

import { Plus } from "lucide-react";
import type { McpConfig } from "@terragon/sandbox/mcp-config";
import { McpServerCard } from "./McpServerCard";

interface McpServerListProps {
  config: McpConfig;
  onEdit: (serverKey: string) => void;
  onRemove: (serverKey: string) => void;
  onAdd: () => void;
  disabled?: boolean;
}

export function McpServerList({
  config,
  onEdit,
  onRemove,
  onAdd,
  disabled,
}: McpServerListProps) {
  const servers = Object.entries(config.mcpServers);
  const isEmpty = servers.length === 0;

  if (isEmpty) {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="w-full rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-full bg-muted p-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Add your first MCP server</p>
            <p className="text-xs text-muted-foreground">
              Connect external tools and data sources to your agent
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {servers.map(([serverKey, serverConfig]) => (
        <McpServerCard
          key={serverKey}
          serverKey={serverKey}
          config={serverConfig}
          onEdit={() => onEdit(serverKey)}
          onRemove={() => onRemove(serverKey)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
