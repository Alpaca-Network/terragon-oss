"use client";

import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import {
  useInfiniteThreadList,
  ThreadListFilters,
} from "@/queries/thread-queries";
import { getKanbanColumn } from "@/components/kanban/types";
import { useRealtimeThreadMatch } from "@/hooks/useRealtime";
import { useAtomValue } from "jotai";
import { userAtom } from "@/atoms/user";

const FAVICON_SIZE = 32;
const BADGE_RADIUS = 7;
const BADGE_FONT_SIZE = 10;
const BADGE_COLOR = "#ef4444"; // Red color for attention
const BADGE_TEXT_COLOR = "#ffffff";

/**
 * Draws a favicon with a badge count overlay
 */
function drawFaviconWithBadge(
  faviconUrl: string,
  count: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = FAVICON_SIZE;
    canvas.height = FAVICON_SIZE;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Draw the base favicon
      ctx.drawImage(img, 0, 0, FAVICON_SIZE, FAVICON_SIZE);

      if (count > 0) {
        // Determine badge text
        const badgeText = count > 99 ? "99+" : String(count);

        // Calculate badge width based on text length
        ctx.font = `bold ${BADGE_FONT_SIZE}px sans-serif`;
        const textMetrics = ctx.measureText(badgeText);
        const textWidth = textMetrics.width;

        // Badge dimensions - pill shape for multi-digit, circle for single digit
        const badgeHeight = BADGE_RADIUS * 2;
        const badgeWidth = Math.max(badgeHeight, textWidth + 6);

        // Badge position (bottom-right corner)
        const badgeX = FAVICON_SIZE - badgeWidth;
        const badgeY = FAVICON_SIZE - badgeHeight;

        // Draw badge background (pill/rounded rectangle)
        ctx.beginPath();
        ctx.fillStyle = BADGE_COLOR;
        if (badgeWidth === badgeHeight) {
          // Circle for single digit
          ctx.arc(
            badgeX + BADGE_RADIUS,
            badgeY + BADGE_RADIUS,
            BADGE_RADIUS,
            0,
            Math.PI * 2,
          );
        } else {
          // Pill shape for multiple digits
          const radius = BADGE_RADIUS;
          ctx.moveTo(badgeX + radius, badgeY);
          ctx.lineTo(badgeX + badgeWidth - radius, badgeY);
          ctx.arc(
            badgeX + badgeWidth - radius,
            badgeY + radius,
            radius,
            -Math.PI / 2,
            Math.PI / 2,
          );
          ctx.lineTo(badgeX + radius, badgeY + badgeHeight);
          ctx.arc(
            badgeX + radius,
            badgeY + radius,
            radius,
            Math.PI / 2,
            -Math.PI / 2,
          );
        }
        ctx.fill();

        // Draw badge text
        ctx.fillStyle = BADGE_TEXT_COLOR;
        ctx.font = `bold ${BADGE_FONT_SIZE}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          badgeText,
          badgeX + badgeWidth / 2,
          badgeY + badgeHeight / 2 + 1, // +1 for visual centering
        );
      }

      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => {
      reject(new Error("Failed to load favicon image"));
    };

    img.src = faviconUrl;
  });
}

/**
 * Updates the favicon in the document head
 */
function updateFavicon(dataUrl: string) {
  // Remove existing dynamic favicon if present
  const existingDynamic = document.querySelector(
    'link[rel="icon"][data-dynamic="true"]',
  );
  if (existingDynamic) {
    existingDynamic.remove();
  }

  // Create new favicon link
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.href = dataUrl;
  link.setAttribute("data-dynamic", "true");

  // Insert at the beginning of head to take precedence
  const head = document.head;
  const firstChild = head.firstChild;
  head.insertBefore(link, firstChild);
}

/**
 * Restores the original favicon by removing dynamic favicon
 */
function restoreFavicon() {
  const dynamicLinks = document.querySelectorAll(
    'link[rel="icon"][data-dynamic="true"]',
  );
  dynamicLinks.forEach((link) => link.remove());
}

/**
 * Hook that dynamically updates the favicon with a badge showing the count
 * of tasks in the "Review" (in_review) Kanban column.
 *
 * Features:
 * - Updates in real-time when tasks move in/out of review
 * - Skips updates when tab is hidden
 * - Only runs for logged-in users
 */
export function useDynamicFavicon() {
  const user = useAtomValue(userAtom);
  const previousCountRef = useRef<number>(-1);
  const [isTabVisible, setIsTabVisible] = useState(() =>
    typeof document !== "undefined"
      ? document.visibilityState === "visible"
      : true,
  );

  // Track tab visibility
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Only fetch threads if user is logged in
  const filters: ThreadListFilters = useMemo(
    () => ({
      archived: false,
      isBacklog: false,
    }),
    [],
  );

  const { data, refetch } = useInfiniteThreadList(filters);

  // Count threads in the in_review column
  const reviewCount = useMemo(() => {
    if (!data?.pages) return 0;

    const threads = data.pages.flatMap((page) => page);
    return threads.filter((thread) => getKanbanColumn(thread) === "in_review")
      .length;
  }, [data]);

  // Set up real-time updates
  const matchThread = useCallback(
    (
      _threadId: string,
      broadcastData: {
        threadStatusUpdated?: string;
        isThreadCreated?: boolean;
        isThreadArchived?: boolean;
      },
    ) => {
      // Match any thread status updates that could affect the review count
      if (broadcastData.threadStatusUpdated) {
        return true;
      }
      // Also match thread creation and archival
      if (
        broadcastData.isThreadCreated ||
        typeof broadcastData.isThreadArchived === "boolean"
      ) {
        return true;
      }
      return false;
    },
    [],
  );

  useRealtimeThreadMatch({
    matchThread,
    onThreadChange: () => {
      refetch();
    },
  });

  // Update favicon when count changes or tab becomes visible
  useEffect(() => {
    // Skip if not in browser or user not logged in
    if (typeof window === "undefined" || !user) {
      return;
    }

    // Skip if tab is not visible
    if (!isTabVisible) {
      return;
    }

    // Skip if count hasn't changed
    if (previousCountRef.current === reviewCount) {
      return;
    }

    previousCountRef.current = reviewCount;

    // Use the PNG favicon as base for canvas drawing
    const baseFaviconUrl = "/favicon.png";

    if (reviewCount === 0) {
      // Restore original favicon when count is 0
      restoreFavicon();
    } else {
      // Draw favicon with badge
      drawFaviconWithBadge(baseFaviconUrl, reviewCount)
        .then((dataUrl) => {
          updateFavicon(dataUrl);
        })
        .catch((error) => {
          console.error("Failed to update favicon:", error);
        });
    }
  }, [reviewCount, user, isTabVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      restoreFavicon();
    };
  }, []);

  return { reviewCount };
}
