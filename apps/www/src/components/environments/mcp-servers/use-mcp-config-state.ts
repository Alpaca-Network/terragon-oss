"use client";

import { useState, useCallback, useMemo } from "react";
import type { McpConfig, McpServer } from "@terragon/sandbox/mcp-config";

interface UseMcpConfigStateOptions {
  initialConfig: McpConfig;
  onDirtyChange?: (isDirty: boolean) => void;
}

interface UseMcpConfigStateReturn {
  /** Current servers configuration */
  servers: Record<string, McpServer>;
  /** Whether the configuration has unsaved changes */
  isDirty: boolean;
  /** List of server keys */
  serverKeys: string[];
  /** Add a new server */
  addServer: (key: string, config: McpServer) => void;
  /** Update an existing server */
  updateServer: (key: string, config: McpServer) => void;
  /** Remove a server */
  removeServer: (key: string) => void;
  /** Rename a server key */
  renameServer: (oldKey: string, newKey: string) => void;
  /** Reset to initial configuration */
  reset: () => void;
  /** Get the current MCP config object */
  getMcpConfig: () => McpConfig;
  /** Check if a server key already exists */
  hasServer: (key: string) => boolean;
}

/**
 * Hook for managing MCP server configuration state
 * Provides add, update, remove, and rename operations with dirty tracking
 */
export function useMcpConfigState({
  initialConfig,
  onDirtyChange,
}: UseMcpConfigStateOptions): UseMcpConfigStateReturn {
  const [servers, setServers] = useState<Record<string, McpServer>>(
    initialConfig.mcpServers,
  );
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = useCallback(() => {
    if (!isDirty) {
      setIsDirty(true);
      onDirtyChange?.(true);
    }
  }, [isDirty, onDirtyChange]);

  const addServer = useCallback(
    (key: string, config: McpServer) => {
      setServers((prev) => ({
        ...prev,
        [key]: config,
      }));
      markDirty();
    },
    [markDirty],
  );

  const updateServer = useCallback(
    (key: string, config: McpServer) => {
      setServers((prev) => ({
        ...prev,
        [key]: config,
      }));
      markDirty();
    },
    [markDirty],
  );

  const removeServer = useCallback(
    (key: string) => {
      setServers((prev) => {
        const { [key]: removed, ...rest } = prev;
        return rest;
      });
      markDirty();
    },
    [markDirty],
  );

  const renameServer = useCallback(
    (oldKey: string, newKey: string) => {
      if (oldKey === newKey) return;

      setServers((prev) => {
        const { [oldKey]: config, ...rest } = prev;
        if (!config) return prev;
        return {
          ...rest,
          [newKey]: config,
        };
      });
      markDirty();
    },
    [markDirty],
  );

  const reset = useCallback(() => {
    setServers(initialConfig.mcpServers);
    setIsDirty(false);
    onDirtyChange?.(false);
  }, [initialConfig.mcpServers, onDirtyChange]);

  const getMcpConfig = useCallback((): McpConfig => {
    return { mcpServers: servers };
  }, [servers]);

  const hasServer = useCallback(
    (key: string): boolean => {
      return key in servers;
    },
    [servers],
  );

  const serverKeys = useMemo(() => Object.keys(servers), [servers]);

  return {
    servers,
    isDirty,
    serverKeys,
    addServer,
    updateServer,
    removeServer,
    renameServer,
    reset,
    getMcpConfig,
    hasServer,
  };
}
