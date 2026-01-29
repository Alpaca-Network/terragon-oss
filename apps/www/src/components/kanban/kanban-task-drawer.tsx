"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  LoaderCircle,
  X,
  MessageSquare,
  GitCommit,
  Maximize2,
  Minimize2,
} from "lucide-react";
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

// Snap points: 75% and 100% of viewport height
const SNAP_POINTS = [0.75, 1] as const;
const DEFAULT_SNAP_POINT = 0.75;

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
  const [currentSnap, setCurrentSnap] = useState<number | string | null>(
    DEFAULT_SNAP_POINT,
  );
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: thread } = useQuery({
    ...threadQueryOptions(threadId ?? ""),
    enabled: !!threadId,
  });

  // Clear any pending reset timeout on unmount or when drawer opens
  useEffect(() => {
    if (open && resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, [open]);

  // Reset tab and snap point when drawer closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      // Clear any existing timeout before setting a new one
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      // Delay reset until after drawer close animation (~300ms)
      resetTimeoutRef.current = setTimeout(() => {
        setActiveTab("feed");
        setCurrentSnap(DEFAULT_SNAP_POINT);
        resetTimeoutRef.current = null;
      }, 300);
    }
  };

  const isMaximized = currentSnap === 1;

  const toggleMaximize = useCallback(() => {
    setCurrentSnap(isMaximized ? 0.75 : 1);
  }, [isMaximized]);

  // Determine height class based on current snap point
  const getHeightClass = () => {
    if (currentSnap === 1) {
      return "h-[100dvh] max-h-[100dvh]";
    }
    return "h-[75dvh] max-h-[75dvh]";
  };

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      snapPoints={SNAP_POINTS as unknown as (number | string)[]}
      activeSnapPoint={currentSnap}
      setActiveSnapPoint={setCurrentSnap}
      fadeFromIndex={0}
    >
      <DrawerContent className={getHeightClass()}>
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMaximize}
              className="h-8 w-8"
              aria-label={isMaximized ? "Minimize" : "Maximize"}
            >
              {isMaximized ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              aria-label="Close task details"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
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
