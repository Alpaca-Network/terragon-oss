import { useEffect, useCallback, useState } from "react";
import { useRealtimeUser } from "./useRealtime";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { NotificationReason } from "@terragon/types/broadcast";

// Store notification permission state
export const notificationPermissionAtom =
  atomWithStorage<NotificationPermission | null>(
    "notificationPermission",
    null,
  );

// Store whether notifications are enabled
export const notificationsEnabledAtom = atomWithStorage<boolean>(
  "notificationsEnabled",
  false,
);

export function useNotifications() {
  const router = useRouter();
  const [permission, setPermission] = useAtom(notificationPermissionAtom);
  const [enabled, setEnabled] = useAtom(notificationsEnabledAtom);
  const [isSupported, setIsSupported] = useState(false);

  // Check if notifications are supported after mount
  useEffect(() => {
    setIsSupported("Notification" in window);
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) return "denied";

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        setEnabled(true);
      }
      return result;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return "denied";
    }
  }, [isSupported, setPermission, setEnabled]);

  // Check current permission status
  useEffect(() => {
    if (isSupported) {
      // Check permission on mount and when window regains focus
      const checkPermission = () => {
        const currentPermission = Notification.permission;
        if (currentPermission !== permission) {
          setPermission(currentPermission);
          // If permission was granted, auto-enable notifications
          if (currentPermission === "granted" && !enabled) {
            setEnabled(true);
          }
        }
      };

      checkPermission();

      // Recheck permission when window regains focus (user might have changed browser settings)
      window.addEventListener("focus", checkPermission);

      return () => window.removeEventListener("focus", checkPermission);
    }
  }, [isSupported, permission, enabled, setPermission, setEnabled]);

  // Show notification
  const showNotification = useCallback(
    (
      title: string,
      options?: NotificationOptions & {
        threadId?: string;
        notificationReason?: NotificationReason;
      },
    ) => {
      if (!isSupported || !enabled || permission !== "granted") return;

      try {
        // Remove custom options before passing to Notification
        const { threadId, notificationReason, ...notificationOptions } =
          options || {};

        const notification = new Notification(title, {
          icon: "/favicon.png",
          badge: "/favicon.png",
          ...notificationOptions,
        });

        // Handle click - navigate to thread if threadId provided
        if (threadId) {
          notification.onclick = () => {
            // For ready-for-review notifications, navigate to comments tab
            if (notificationReason === "ready-for-review") {
              router.push(`/task/${threadId}?panel=comments`);
            } else if (notificationReason === "task-archived") {
              // For archived tasks, go to archived view
              router.push(`/archived`);
            } else {
              router.push(`/task/${threadId}`);
            }
            notification.close();
            window.focus();
          };
        }

        // Auto close after 10 seconds
        setTimeout(() => notification.close(), 10000);
      } catch (error) {
        console.error("Error showing notification:", error);
      }
    },
    [isSupported, enabled, permission, router],
  );

  // Listen for unread thread updates
  useRealtimeUser({
    matches: (message) => {
      // Only match if notifications are supported
      if (!isSupported) {
        return false;
      }
      // Match when a thread is marked as unread
      if (message.data.isThreadUnread === true) {
        return true;
      }
      // Also check dataByThreadId for batch updates
      if (message.dataByThreadId) {
        for (const data of Object.values(message.dataByThreadId)) {
          if (data.isThreadUnread === true) {
            return true;
          }
        }
      }
      return false;
    },
    onMessage: (message) => {
      if (!isSupported || !enabled || permission !== "granted") return;

      // Helper to get notification title and body based on reason
      const getNotificationContent = (
        threadName: string | undefined,
        notificationReason: NotificationReason | undefined,
      ) => {
        switch (notificationReason) {
          case "ready-for-review":
            return {
              title: "Task Ready for Review",
              body: threadName
                ? `${threadName} - Click to view PR feedback`
                : "A task has PR feedback to review",
            };
          case "task-archived":
            return {
              title: "Task Completed and Archived",
              body: threadName
                ? `${threadName} - Click to view in archived`
                : "A task has been completed and archived",
            };
          case "task-complete":
          default:
            return {
              title: "A Task is Finished Working",
              body: threadName || "A task has finished working",
            };
        }
      };

      // Handle single thread update
      if (message.data.threadId && message.data.isThreadUnread === true) {
        const threadId = message.data.threadId;
        const threadName = message.data.threadName;
        const notificationReason = message.data.notificationReason;

        // Show notification if tab is not active, even if we're on the thread
        const currentPath = window.location.pathname;
        const isOnThread = currentPath === `/task/${threadId}`;
        const isTabActive = !document.hidden;

        // Only skip notification if we're on the thread AND the tab is active
        if (isOnThread && isTabActive) return;

        const { title, body } = getNotificationContent(
          threadName,
          notificationReason,
        );

        showNotification(title, {
          body,
          tag: `thread-${threadId}-${notificationReason || "task-complete"}`,
          requireInteraction: false,
          threadId,
          notificationReason,
        });
      }

      // Handle batch updates
      if (message.dataByThreadId) {
        for (const [threadId, data] of Object.entries(message.dataByThreadId)) {
          if (data.isThreadUnread === true) {
            // Show notification if tab is not active, even if we're on the thread
            const currentPath = window.location.pathname;
            const isOnThread = currentPath === `/task/${threadId}`;
            const isTabActive = !document.hidden;

            // Only skip notification if we're on the thread AND the tab is active
            if (isOnThread && isTabActive) continue;

            const threadName = data.threadName;
            const notificationReason = data.notificationReason;

            const { title, body } = getNotificationContent(
              threadName,
              notificationReason,
            );

            showNotification(title, {
              body,
              tag: `thread-${threadId}-${notificationReason || "task-complete"}`,
              requireInteraction: false,
              threadId,
              notificationReason,
            });
          }
        }
      }
    },
  });

  return {
    isSupported,
    permission,
    enabled,
    setEnabled,
    requestPermission,
    showNotification,
  };
}
