"use client";

import { Pencil, Trash2, Terminal, Globe, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { McpServer } from "@terragon/sandbox/mcp-config";
import type { McpServerType } from "@/lib/mcp-registry";

interface McpServerCardProps {
  serverKey: string;
  config: McpServer;
  onEdit: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

function getServerType(config: McpServer): McpServerType {
  if ("command" in config) {
    return "command";
  }
  if ("type" in config && config.type === "sse") {
    return "sse";
  }
  return "http";
}

function ServerTypeIcon({ type }: { type: McpServerType }) {
  switch (type) {
    case "command":
      return <Terminal className="h-3.5 w-3.5" />;
    case "http":
      return <Globe className="h-3.5 w-3.5" />;
    case "sse":
      return <Radio className="h-3.5 w-3.5" />;
  }
}

function ServerTypeBadge({ type }: { type: McpServerType }) {
  const labels: Record<McpServerType, string> = {
    command: "Command",
    http: "HTTP",
    sse: "SSE",
  };

  return (
    <Badge variant="secondary" className="text-xs gap-1 font-normal">
      <ServerTypeIcon type={type} />
      {labels[type]}
    </Badge>
  );
}

function getServerSummary(config: McpServer): string {
  if ("command" in config) {
    const args = config.args?.join(" ") || "";
    return `${config.command} ${args}`.trim();
  }
  if ("url" in config) {
    try {
      const url = new URL(config.url);
      return url.hostname;
    } catch {
      return config.url;
    }
  }
  return "";
}

export function McpServerCard({
  serverKey,
  config,
  onEdit,
  onRemove,
  disabled,
}: McpServerCardProps) {
  const serverType = getServerType(config);
  const summary = getServerSummary(config);
  const hasCredentials = config.env && Object.keys(config.env).length > 0;

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{serverKey}</span>
          <ServerTypeBadge type={serverType} />
          {hasCredentials && (
            <Badge variant="outline" className="text-xs font-normal">
              Credentials
            </Badge>
          )}
        </div>
        {summary && (
          <p className="text-xs text-muted-foreground truncate font-mono">
            {summary}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onEdit}
          disabled={disabled}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">Edit {serverKey}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onRemove}
          disabled={disabled}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Remove {serverKey}</span>
        </Button>
      </div>
    </div>
  );
}
