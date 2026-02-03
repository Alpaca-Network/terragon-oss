"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Terminal,
  Globe,
  Radio,
  ExternalLink,
} from "lucide-react";
import * as Icons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CredentialFieldInput } from "./CredentialFieldInput";
import type {
  CuratedMcpServer,
  RegistrySearchResult,
  McpServerType,
} from "@/lib/mcp-registry";
import type { McpServer } from "@terragon/sandbox/mcp-config";
import { validateMcpConfig } from "@terragon/sandbox/mcp-config";

interface ConfigureMcpServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: CuratedMcpServer | RegistrySearchResult | null;
  existingServerKeys: string[];
  onAdd: (serverKey: string, config: McpServer) => void;
  editMode?: {
    serverKey: string;
    existingConfig: McpServer;
  };
}

function isCuratedServer(
  server: CuratedMcpServer | RegistrySearchResult,
): server is CuratedMcpServer {
  return "credentialFields" in server;
}

function getServerIcon(server: CuratedMcpServer | RegistrySearchResult) {
  if (isCuratedServer(server)) {
    const IconComponent = (
      Icons as unknown as Record<string, Icons.LucideIcon>
    )[server.iconName];
    if (IconComponent) {
      return <IconComponent className="h-5 w-5" />;
    }
  }
  return <Terminal className="h-5 w-5" />;
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

function generateDefaultServerKey(
  server: CuratedMcpServer | RegistrySearchResult,
  existingKeys: string[],
): string {
  let baseName = server.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!existingKeys.includes(baseName)) {
    return baseName;
  }

  // Add suffix if name exists
  let counter = 2;
  while (existingKeys.includes(`${baseName}-${counter}`)) {
    counter++;
  }
  return `${baseName}-${counter}`;
}

function buildInitialConfig(
  server: CuratedMcpServer | RegistrySearchResult,
): McpServer {
  if (isCuratedServer(server)) {
    if (server.serverType === "command") {
      return {
        command: server.configTemplate.command || "",
        args: server.configTemplate.args,
        env: {},
      };
    } else {
      return {
        type: server.serverType as "http" | "sse",
        url: server.configTemplate.url || "",
        headers: server.configTemplate.headers,
        env: {},
      };
    }
  }

  // Registry result
  if (server.serverType === "command") {
    return {
      command: server.connectionConfig?.command || "npx",
      args: server.connectionConfig?.args || [],
      env: {},
    };
  } else {
    return {
      type: server.serverType as "http" | "sse",
      url: server.connectionConfig?.url || "",
      env: {},
    };
  }
}

export function ConfigureMcpServerDialog({
  open,
  onOpenChange,
  server,
  existingServerKeys,
  onAdd,
  editMode,
}: ConfigureMcpServerDialogProps) {
  const [serverKey, setServerKey] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedJson, setAdvancedJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Reset form when dialog opens with a new server
  useEffect(() => {
    if (open && server) {
      if (editMode) {
        setServerKey(editMode.serverKey);
        // Extract credentials from existing config
        const existingEnv = editMode.existingConfig.env || {};
        setCredentials(existingEnv);
        setAdvancedJson(JSON.stringify(editMode.existingConfig, null, 2));
      } else {
        setServerKey(generateDefaultServerKey(server, existingServerKeys));
        setCredentials({});
        const initialConfig = buildInitialConfig(server);
        setAdvancedJson(JSON.stringify(initialConfig, null, 2));
      }
      setShowAdvanced(false);
      setJsonError(null);
    }
  }, [open, server, existingServerKeys, editMode]);

  const credentialFields = useMemo(() => {
    if (!server) return [];
    return isCuratedServer(server) ? server.credentialFields : [];
  }, [server]);

  const handleCredentialChange = (fieldName: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleAdvancedJsonChange = (value: string) => {
    setAdvancedJson(value);
    setJsonError(null);

    if (value.trim()) {
      try {
        JSON.parse(value);
      } catch {
        setJsonError("Invalid JSON format");
      }
    }
  };

  const buildFinalConfig = (): McpServer | null => {
    if (!server) return null;

    // If advanced mode is open and has content, use that
    if (showAdvanced && advancedJson.trim()) {
      try {
        const parsed = JSON.parse(advancedJson);
        // Merge credentials into env
        if (Object.keys(credentials).length > 0) {
          const envVars: Record<string, string> = { ...parsed.env };
          if (isCuratedServer(server)) {
            for (const field of server.credentialFields) {
              const credValue = credentials[field.name];
              if (credValue) {
                envVars[field.envVarName] = credValue;
              }
            }
          } else {
            // For registry results, just use credentials as-is
            Object.assign(envVars, credentials);
          }
          parsed.env = Object.keys(envVars).length > 0 ? envVars : undefined;
        }
        return parsed;
      } catch {
        return null;
      }
    }

    // Build from structured inputs
    const baseConfig = buildInitialConfig(server);

    // Add credentials as env vars
    const envVars: Record<string, string> = {};
    if (isCuratedServer(server)) {
      for (const field of server.credentialFields) {
        const credValue = credentials[field.name];
        if (credValue) {
          envVars[field.envVarName] = credValue;
        }
      }
    }

    if (Object.keys(envVars).length > 0) {
      baseConfig.env = envVars;
    }

    return baseConfig;
  };

  const handleSubmit = () => {
    if (!server) return;

    // Validate server key
    const trimmedKey = serverKey.trim();
    if (!trimmedKey) {
      toast.error("Please enter a server name");
      return;
    }

    if (trimmedKey === "terry") {
      toast.error("Cannot use 'terry' as a server name (reserved)");
      return;
    }

    // Check for duplicate key (unless editing the same key)
    if (
      existingServerKeys.includes(trimmedKey) &&
      (!editMode || editMode.serverKey !== trimmedKey)
    ) {
      toast.error(`Server '${trimmedKey}' already exists`);
      return;
    }

    // Validate required credentials
    if (isCuratedServer(server)) {
      for (const field of server.credentialFields) {
        if (field.required && !credentials[field.name]?.trim()) {
          toast.error(`${field.label} is required`);
          return;
        }
      }
    }

    // Build and validate config
    const config = buildFinalConfig();
    if (!config) {
      toast.error("Invalid configuration");
      return;
    }

    // Validate against MCP schema
    const validation = validateMcpConfig({
      mcpServers: { [trimmedKey]: config },
    });
    if (!validation.success) {
      toast.error(validation.error);
      return;
    }

    onAdd(trimmedKey, config);
    onOpenChange(false);
  };

  if (!server) return null;

  const title = editMode
    ? `Edit ${editMode.serverKey}`
    : `Add ${server.displayName}`;
  const description = server.description;
  const docsUrl = isCuratedServer(server) ? server.docsUrl : server.homepage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              {getServerIcon(server)}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2">
                {title}
                <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <ServerTypeIcon type={server.serverType} />
                  {server.serverType.toUpperCase()}
                </span>
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="mt-2">
            {description}
            {docsUrl && (
              <>
                {" "}
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  Documentation
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Server Name */}
          <div className="space-y-1.5">
            <Label htmlFor="server-key" className="text-sm font-medium">
              Server Name
            </Label>
            <Input
              id="server-key"
              value={serverKey}
              onChange={(e) =>
                setServerKey(e.target.value.toLowerCase().replace(/\s+/g, "-"))
              }
              placeholder="my-server"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier for this server in your configuration
            </p>
          </div>

          {/* Credential Fields */}
          {credentialFields.length > 0 && (
            <div className="space-y-3">
              {credentialFields.map((field) => (
                <CredentialFieldInput
                  key={field.name}
                  field={field}
                  value={credentials[field.name] || ""}
                  onChange={(value) =>
                    handleCredentialChange(field.name, value)
                  }
                />
              ))}
            </div>
          )}

          {/* Setup Instructions */}
          {isCuratedServer(server) && server.setupInstructions && (
            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Setup Note</p>
              <p>{server.setupInstructions}</p>
            </div>
          )}

          {/* Advanced Configuration */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-0 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (!showAdvanced) {
                  // Update JSON with current credentials before showing
                  const config = buildFinalConfig();
                  if (config) {
                    setAdvancedJson(JSON.stringify(config, null, 2));
                  }
                }
                setShowAdvanced(!showAdvanced);
              }}
            >
              {showAdvanced ? (
                <ChevronDown className="mr-1 h-4 w-4" />
              ) : (
                <ChevronRight className="mr-1 h-4 w-4" />
              )}
              Advanced Configuration
            </Button>

            {showAdvanced && (
              <div className="space-y-1.5">
                <Textarea
                  value={advancedJson}
                  onChange={(e) => handleAdvancedJsonChange(e.target.value)}
                  className="font-mono text-xs min-h-[150px]"
                  placeholder='{"command": "...", "args": [...], "env": {...}}'
                />
                {jsonError && (
                  <p className="text-xs text-destructive">{jsonError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Edit the raw JSON configuration. Credentials from the fields
                  above will be merged into the env object.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!!jsonError}>
            {editMode ? "Save Changes" : "Add Server"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
