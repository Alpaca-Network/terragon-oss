import { useCallback, useEffect } from "react";
import { useReadThreadMutation } from "@/queries/thread-mutations";
import { getThreadDocumentTitle } from "@/agent/thread-utils";
import { useDocumentVisibility } from "@/hooks/useDocumentVisibility";
import { secondaryPaneClosedAtom } from "@/atoms/user-cookies";
import { atom, useAtom } from "jotai";
import { usePlatform } from "@/hooks/use-platform";
import { threadQueryKeys } from "@/queries/thread-queries";
import { ThreadChatInfoFull, ThreadInfoFull } from "@terragon/shared/db/types";
import { useQueryClient } from "@tanstack/react-query";

export function useMarkChatAsRead({
  threadId,
  threadChatId,
  threadIsUnread,
  isReadOnly,
}: {
  threadId: string;
  threadChatId: string | undefined;
  threadIsUnread: boolean;
  isReadOnly: boolean;
}) {
  const readThreadMutation = useReadThreadMutation();
  const markAsRead = useCallback(async () => {
    if (threadChatId) {
      await readThreadMutation.mutateAsync({
        threadId,
        threadChatIdOrNull: threadChatId,
      });
    }
  }, [threadId, threadChatId, readThreadMutation]);
  // Mark thread as read when it becomes visible
  const isDocumentVisible = useDocumentVisibility();
  useEffect(() => {
    if (isReadOnly) {
      return;
    }
    if (threadIsUnread && isDocumentVisible) {
      markAsRead();
    }
  }, [threadIsUnread, isDocumentVisible, markAsRead, isReadOnly]);
}

export function useThreadDocumentTitleAndFavicon({
  name,
  isThreadUnread,
}: {
  name: string;
  isThreadUnread: boolean;
  isReadOnly: boolean;
}) {
  // Update document title based on unread messages
  const documentTitle = name
    ? getThreadDocumentTitle({ name, isUnread: isThreadUnread })
    : "Terragon";
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.title = documentTitle;
    // Favicon is always Gatewayz logo (set in layout.tsx)
  }, [documentTitle]);
}

const secondaryPanelIsOpenLocalAtom = atom<boolean>(false);

export function useSecondaryPanel() {
  const platform = usePlatform();
  const [isSecondaryPanelOpenLocal, setIsSecondaryPanelOpenLocal] = useAtom(
    secondaryPanelIsOpenLocalAtom,
  );
  const [isSecondaryPaneClosedCookie, setIsSecondaryPaneClosedCookie] = useAtom(
    secondaryPaneClosedAtom,
  );
  const setIsSecondaryPanelOpen = useCallback(
    (open: boolean) => {
      setIsSecondaryPanelOpenLocal(open);
      setIsSecondaryPaneClosedCookie(!open);
    },
    [setIsSecondaryPanelOpenLocal, setIsSecondaryPaneClosedCookie],
  );
  return {
    shouldAutoOpenSecondaryPanel:
      platform === "desktop" && !isSecondaryPaneClosedCookie,
    isSecondaryPanelOpen: isSecondaryPanelOpenLocal,
    setIsSecondaryPanelOpen,
  };
}

export function useOptimisticUpdateThreadChat({
  threadId,
  threadChatId,
}: {
  threadId: string | undefined;
  threadChatId: string | undefined;
}) {
  const queryClient = useQueryClient();
  return useCallback(
    (updates: Partial<ThreadChatInfoFull>) => {
      if (!threadId || !threadChatId) {
        return;
      }
      queryClient.setQueryData<ThreadInfoFull>(
        threadQueryKeys.detail(threadId),
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            threadChats: oldData.threadChats.map((tc) =>
              tc.id === threadChatId ? { ...tc, ...updates } : tc,
            ),
          };
        },
      );
    },
    [queryClient, threadId, threadChatId],
  );
}
