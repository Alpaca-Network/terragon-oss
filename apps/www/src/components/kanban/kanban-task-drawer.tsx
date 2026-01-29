"use client";

import { memo, useState } from "react";
import dynamic from "next/dynamic";
import { LoaderCircle, X, MessageSquare, GitCommit } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { threadQueryOptions } from "@/queries/thread-queries";

const ChatUI = dynamic(() => import("@/components/chat/chat-ui"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

const GitDiffView = dynamic(
  () =>
    import("@/components/chat/git-diff-view").then((mod) => mod.GitDiffView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

type TabType = "feed" | "changes";

export const KanbanTaskDrawer = memo(function KanbanTaskDrawer({
  threadId,
  open,
  onClose,
}: {
  threadId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabType>("feed");

  const { data: thread } = useQuery({
    ...threadQueryOptions(threadId ?? ""),
    enabled: !!threadId,
  });

  // Reset tab when drawer closes (delayed to avoid flash during close animation)
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      // Delay tab reset until after drawer close animation (~300ms)
      setTimeout(() => setActiveTab("feed"), 300);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[85vh] max-h-[85vh]">
        <DrawerHeader className="flex flex-row items-center justify-between border-b py-2 px-3 flex-shrink-0">
          <div className="flex items-center gap-1">
            <Button
              variant={activeTab === "feed" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3 gap-1.5"
              onClick={() => setActiveTab("feed")}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs">Feed</span>
            </Button>
            <Button
              variant={activeTab === "changes" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3 gap-1.5"
              onClick={() => setActiveTab("changes")}
              disabled={!thread?.gitDiff}
            >
              <GitCommit className="h-4 w-4" />
              <span className="text-xs">Changes</span>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Close task details"
          >
            <X className="h-4 w-4" />
          </Button>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          {threadId && activeTab === "feed" && (
            <ChatUI threadId={threadId} isReadOnly={false} />
          )}
          {thread && activeTab === "changes" && (
            <div className="h-full overflow-auto">
              <GitDiffView thread={thread} />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
});
