"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validateMcpConfig } from "@terragon/sandbox/mcp-config";
import type { McpServer } from "@terragon/sandbox/mcp-config";

interface ManualConfigTabProps {
  onAddServer: (serverKey: string, config: McpServer) => void;
  existingServerKeys: string[];
  onClose: () => void;
}

const EXAMPLE_CONFIGS = {
  command: `{
  "command": "npx",
  "args": ["-y", "@example/mcp-server"],
  "env": {
    "API_KEY": "your-api-key"
  }
}`,
  http: `{
  "type": "http",
  "url": "https://mcp.example.com/api",
  "headers": {
    "Authorization": "Bearer your-token"
  }
}`,
};

export function ManualConfigTab({
  onAddServer,
  existingServerKeys,
  onClose,
}: ManualConfigTabProps) {
  const [serverKey, setServerKey] = useState("");
  const [configJson, setConfigJson] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleConfigChange = (value: string) => {
    setConfigJson(value);
    setError(null);

    if (value.trim()) {
      try {
        JSON.parse(value);
      } catch {
        setError("Invalid JSON format");
      }
    }
  };

  const handleSubmit = () => {
    // Validate server key
    const trimmedKey = serverKey.trim().toLowerCase().replace(/\s+/g, "-");
    if (!trimmedKey) {
      toast.error("Please enter a server name");
      return;
    }

    if (trimmedKey === "terry") {
      toast.error("Cannot use 'terry' as a server name (reserved)");
      return;
    }

    if (existingServerKeys.includes(trimmedKey)) {
      toast.error(`Server '${trimmedKey}' already exists`);
      return;
    }

    // Validate JSON
    if (!configJson.trim()) {
      toast.error("Please enter a configuration");
      return;
    }

    let parsed: McpServer;
    try {
      parsed = JSON.parse(configJson);
    } catch {
      toast.error("Invalid JSON format");
      return;
    }

    // Validate against MCP schema
    const validation = validateMcpConfig({
      mcpServers: { [trimmedKey]: parsed },
    });
    if (!validation.success) {
      toast.error(validation.error);
      return;
    }

    onAddServer(trimmedKey, parsed);
    onClose();
  };

  const loadExample = (type: "command" | "http") => {
    setConfigJson(EXAMPLE_CONFIGS[type]);
    setError(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Manually configure an MCP server by entering the JSON configuration.
      </p>

      {/* Server Name */}
      <div className="space-y-1.5">
        <Label htmlFor="manual-server-key" className="text-sm font-medium">
          Server Name
        </Label>
        <Input
          id="manual-server-key"
          value={serverKey}
          onChange={(e) =>
            setServerKey(e.target.value.toLowerCase().replace(/\s+/g, "-"))
          }
          placeholder="my-server"
          className="font-mono"
        />
      </div>

      {/* JSON Configuration */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="manual-config" className="text-sm font-medium">
            Configuration
          </Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => loadExample("command")}
            >
              Command Example
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => loadExample("http")}
            >
              HTTP Example
            </Button>
          </div>
        </div>
        <Textarea
          id="manual-config"
          value={configJson}
          onChange={(e) => handleConfigChange(e.target.value)}
          placeholder='{"command": "...", "args": [...], "env": {...}}'
          className="font-mono text-xs min-h-[200px]"
        />
        {error && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!!error || !configJson.trim()}>
          Add Server
        </Button>
      </div>
    </div>
  );
}
