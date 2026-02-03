"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecommendedServersTab } from "./RecommendedServersTab";
import { SearchRegistryTab } from "./SearchRegistryTab";
import { ManualConfigTab } from "./ManualConfigTab";
import { ConfigureMcpServerDialog } from "./ConfigureMcpServerDialog";
import type {
  CuratedMcpServer,
  RegistrySearchResult,
} from "@/lib/mcp-registry";
import type { McpServer } from "@terragon/sandbox/mcp-config";

interface BrowseMcpServersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingServerKeys: string[];
  onAddServer: (serverKey: string, config: McpServer) => void;
}

export function BrowseMcpServersDialog({
  open,
  onOpenChange,
  existingServerKeys,
  onAddServer,
}: BrowseMcpServersDialogProps) {
  const [activeTab, setActiveTab] = useState("recommended");
  const [selectedServer, setSelectedServer] = useState<
    CuratedMcpServer | RegistrySearchResult | null
  >(null);
  const [configureDialogOpen, setConfigureDialogOpen] = useState(false);

  const handleSelectServer = (
    server: CuratedMcpServer | RegistrySearchResult,
  ) => {
    setSelectedServer(server);
    setConfigureDialogOpen(true);
  };

  const handleAddServer = (serverKey: string, config: McpServer) => {
    onAddServer(serverKey, config);
    setSelectedServer(null);
    setConfigureDialogOpen(false);
    onOpenChange(false);
  };

  const handleManualAdd = (serverKey: string, config: McpServer) => {
    onAddServer(serverKey, config);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Browse MCP Servers</DialogTitle>
            <DialogDescription>
              Add external tools and data sources to your coding agent
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="mx-6 justify-start">
              <TabsTrigger value="recommended">Recommended</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="manual">Advanced</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 px-6 pb-6">
              <TabsContent
                value="recommended"
                className="mt-4 focus-visible:outline-none"
              >
                <RecommendedServersTab
                  onSelectServer={handleSelectServer}
                  existingServerKeys={existingServerKeys}
                />
              </TabsContent>

              <TabsContent
                value="search"
                className="mt-4 focus-visible:outline-none"
              >
                <SearchRegistryTab
                  onSelectServer={handleSelectServer}
                  existingServerKeys={existingServerKeys}
                />
              </TabsContent>

              <TabsContent
                value="manual"
                className="mt-4 focus-visible:outline-none"
              >
                <ManualConfigTab
                  onAddServer={handleManualAdd}
                  existingServerKeys={existingServerKeys}
                  onClose={() => onOpenChange(false)}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ConfigureMcpServerDialog
        open={configureDialogOpen}
        onOpenChange={setConfigureDialogOpen}
        server={selectedServer}
        existingServerKeys={existingServerKeys}
        onAdd={handleAddServer}
      />
    </>
  );
}
