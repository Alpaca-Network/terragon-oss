"use client";

import React from "react";
import { useAtom } from "jotai";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { ThreadInfoFull } from "@terragon/shared";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { GitDiffView } from "./git-diff-view";
import { CodeReviewView } from "./code-review-view";
import { usePlatform } from "@/hooks/use-platform";
import { useSecondaryPanel } from "./hooks";
import { secondaryPanelViewAtom } from "@/atoms/user-cookies";

const SECONDARY_PANEL_MIN_WIDTH = 300;
const SECONDARY_PANEL_MAX_WIDTH_PERCENTAGE = 0.7;
const SECONDARY_PANEL_DEFAULT_WIDTH = 0.5;

export function SecondaryPanel({
  thread,
  containerRef,
}: {
  thread: ThreadInfoFull;
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const platform = usePlatform();
  const {
    isSecondaryPanelOpen: isOpen,
    setIsSecondaryPanelOpen: onOpenChange,
  } = useSecondaryPanel();
  const { width, isResizing, handleMouseDown } = useResizablePanel({
    minWidth: SECONDARY_PANEL_MIN_WIDTH,
    maxWidth: SECONDARY_PANEL_MAX_WIDTH_PERCENTAGE,
    defaultWidth: SECONDARY_PANEL_DEFAULT_WIDTH,
    mode: "percentage",
    direction: "rtl",
    containerRef,
    enabled: isOpen && platform === "desktop",
  });
  if (platform === "mobile") {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[80vh]">
          <SecondaryPanelContent thread={thread} />
        </DrawerContent>
      </Drawer>
    );
  }
  if (!isOpen) return null;
  return (
    <>
      <div
        className={cn(
          "w-1.5 cursor-col-resize hover:bg-blue-500/50 transition-colors flex-shrink-0",
          isResizing && "bg-blue-500/50",
        )}
        onMouseDown={handleMouseDown}
      />
      <div
        className="flex-shrink-0 border-l bg-background flex flex-col h-full"
        style={{ width: `${width}px` }}
      >
        <SecondaryPanelContent thread={thread} />
      </div>
    </>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      )}
    >
      {children}
    </button>
  );
}

function SecondaryPanelContent({ thread }: { thread?: ThreadInfoFull }) {
  const [activeView, setActiveView] = useAtom(secondaryPanelViewAtom);

  if (!thread) {
    return null;
  }

  // Only show view toggle if thread has a PR
  const hasPR =
    thread.githubPRNumber !== null && thread.githubPRNumber !== undefined;

  return (
    <div className="flex flex-col h-full">
      {hasPR && (
        <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
          <ViewTab
            active={activeView === "files-changed"}
            onClick={() => setActiveView("files-changed")}
          >
            Files Changed
          </ViewTab>
          <ViewTab
            active={activeView === "code-review"}
            onClick={() => setActiveView("code-review")}
          >
            Code Review
          </ViewTab>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {activeView === "code-review" && hasPR ? (
          <CodeReviewView thread={thread} />
        ) : (
          <GitDiffView thread={thread} />
        )}
      </div>
    </div>
  );
}
