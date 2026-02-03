"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, Code, LayoutGrid } from "lucide-react";
import { McpConfig, McpServer } from "@terragon/sandbox/mcp-config";
import {
  McpServerList,
  McpJsonEditor,
  AddMcpServerButton,
  BrowseMcpServersDialog,
  ConfigureMcpServerDialog,
} from "./mcp-servers";
import type {
  CuratedMcpServer,
  RegistrySearchResult,
} from "@/lib/mcp-registry";
import { findCuratedServer } from "@/lib/mcp-registry";

interface McpConfigEditorProps {
  value: McpConfig;
  onChange: (config: McpConfig) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  disabled?: boolean;
}

type EditorMode = "visual" | "json";

export function McpConfigEditor({
  value,
  onChange,
  onDirtyChange,
  disabled,
}: McpConfigEditorProps) {
  const [mode, setMode] = useState<EditorMode>("visual");
  const [localConfig, setLocalConfig] = useState<McpConfig>(value);
  const [isDirty, setIsDirty] = useState(false);
  const [browseDialogOpen, setBrowseDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<{
    serverKey: string;
    config: McpServer;
    source: CuratedMcpServer | RegistrySearchResult | null;
  } | null>(null);

  // Sync local config with prop value when it changes externally
  useEffect(() => {
    if (!isDirty) {
      setLocalConfig(value);
    }
  }, [value, isDirty]);

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const serverKeys = useMemo(
    () => Object.keys(localConfig.mcpServers),
    [localConfig.mcpServers],
  );

  const markDirty = useCallback(() => {
    if (!isDirty) {
      setIsDirty(true);
    }
  }, [isDirty]);

  const handleAddServer = useCallback(
    (serverKey: string, config: McpServer) => {
      setLocalConfig((prev) => ({
        mcpServers: {
          ...prev.mcpServers,
          [serverKey]: config,
        },
      }));
      markDirty();
    },
    [markDirty],
  );

  const handleRemoveServer = useCallback(
    (serverKey: string) => {
      setLocalConfig((prev) => {
        const { [serverKey]: removed, ...rest } = prev.mcpServers;
        return { mcpServers: rest };
      });
      markDirty();
    },
    [markDirty],
  );

  const handleEditServer = useCallback(
    (serverKey: string) => {
      const config = localConfig.mcpServers[serverKey];
      if (!config) return;

      // Try to find the curated server for this config
      const curatedServer = findCuratedServer(serverKey);

      setEditingServer({
        serverKey,
        config,
        source: curatedServer || null,
      });
    },
    [localConfig.mcpServers],
  );

  const handleUpdateServer = useCallback(
    (serverKey: string, config: McpServer) => {
      setLocalConfig((prev) => {
        // Handle rename: if the key changed, remove old key
        const oldKey = editingServer?.serverKey;
        if (oldKey && oldKey !== serverKey) {
          const { [oldKey]: removed, ...rest } = prev.mcpServers;
          return {
            mcpServers: {
              ...rest,
              [serverKey]: config,
            },
          };
        }
        return {
          mcpServers: {
            ...prev.mcpServers,
            [serverKey]: config,
          },
        };
      });
      setEditingServer(null);
      markDirty();
    },
    [editingServer?.serverKey, markDirty],
  );

  const handleSave = useCallback(() => {
    onChange(localConfig);
    setIsDirty(false);
    toast.success("MCP configuration saved");
  }, [localConfig, onChange]);

  const handleReset = useCallback(() => {
    setLocalConfig(value);
    setIsDirty(false);
  }, [value]);

  const handleJsonChange = useCallback(
    (config: McpConfig) => {
      setLocalConfig(config);
      onChange(config);
      setIsDirty(false);
    },
    [onChange],
  );

  // For JSON mode, track dirty state separately
  const handleJsonDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant={mode === "visual" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-2.5"
            onClick={() => setMode("visual")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Visual
          </Button>
          <Button
            variant={mode === "json" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-2.5"
            onClick={() => setMode("json")}
          >
            <Code className="h-3.5 w-3.5" />
            JSON
          </Button>
        </div>

        {mode === "visual" && serverKeys.length > 0 && (
          <AddMcpServerButton
            onClick={() => setBrowseDialogOpen(true)}
            disabled={disabled}
          />
        )}
      </div>

      {/* Visual Editor */}
      {mode === "visual" && (
        <>
          <McpServerList
            config={localConfig}
            onEdit={handleEditServer}
            onRemove={handleRemoveServer}
            onAdd={() => setBrowseDialogOpen(true)}
            disabled={disabled}
          />

          {/* Save/Reset Buttons */}
          {isDirty && (
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={disabled}
              >
                <Check className="h-3 w-3 mr-1" />
                Save MCP Config
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={disabled}
              >
                Reset
              </Button>
            </div>
          )}
        </>
      )}

      {/* JSON Editor */}
      {mode === "json" && (
        <McpJsonEditor
          value={localConfig}
          onChange={handleJsonChange}
          onDirtyChange={handleJsonDirtyChange}
          disabled={disabled}
        />
      )}

      {/* Browse Dialog */}
      <BrowseMcpServersDialog
        open={browseDialogOpen}
        onOpenChange={setBrowseDialogOpen}
        existingServerKeys={serverKeys}
        onAddServer={handleAddServer}
      />

      {/* Edit Dialog */}
      {editingServer && (
        <ConfigureMcpServerDialog
          open={!!editingServer}
          onOpenChange={(open) => !open && setEditingServer(null)}
          server={editingServer.source}
          existingServerKeys={serverKeys.filter(
            (k) => k !== editingServer.serverKey,
          )}
          onAdd={handleUpdateServer}
          editMode={{
            serverKey: editingServer.serverKey,
            existingConfig: editingServer.config,
          }}
        />
      )}
    </div>
  );
}
