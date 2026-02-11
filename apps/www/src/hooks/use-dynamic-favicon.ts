"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRealtimeThreadMatch } from "@/hooks/useRealtime";
import { useAtomValue } from "jotai";
import { userAtom } from "@/atoms/user";
import { useQuery } from "@tanstack/react-query";
import { getReviewCountAction } from "@/server-actions/get-review-count";
import { unwrapResult } from "@/lib/server-actions";
import { useDebouncedCallback } from "use-debounce";

const FAVICON_SIZE = 32;
// Badge takes up ~1/4 of favicon (16px diameter = 8px radius)
const BADGE_RADIUS = 8;
const BADGE_FONT_SIZE = 12;
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
        const badgeWidth = Math.max(badgeHeight, textWidth + 8); // More padding for text

        // Badge position (top-right corner, slight inset for visibility)
        const badgeX = FAVICON_SIZE - badgeWidth;
        const badgeY = 0;

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
 * Updates the favicon in the document head.
 * Hides the static favicons and adds a dynamic one to ensure it takes precedence.
 */
function updateFavicon(dataUrl: string) {
  // Hide existing static favicons (SVG and PNG) so our dynamic one takes precedence
  // We hide instead of remove so we can restore them later
  const staticFavicons = document.querySelectorAll(
    'link[rel="icon"]:not([data-dynamic="true"])',
  );
  staticFavicons.forEach((link) => {
    (link as HTMLLinkElement).setAttribute("data-hidden-by-dynamic", "true");
    (link as HTMLLinkElement).rel = "prefetch"; // Change rel to prevent it from being used as favicon
  });

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
 * Restores the original favicon by removing dynamic favicon and unhiding static ones
 */
function restoreFavicon() {
  // Remove dynamic favicon
  const dynamicLinks = document.querySelectorAll(
    'link[rel="icon"][data-dynamic="true"]',
  );
  dynamicLinks.forEach((link) => link.remove());

  // Restore hidden static favicons
  const hiddenFavicons = document.querySelectorAll(
    'link[data-hidden-by-dynamic="true"]',
  );
  hiddenFavicons.forEach((link) => {
    (link as HTMLLinkElement).rel = "icon";
    (link as HTMLLinkElement).removeAttribute("data-hidden-by-dynamic");
  });
}

/**
 * Hook that dynamically updates the favicon with a badge showing the count
 * of tasks in the "Review" (in_review) Kanban column.
 *
 * Features:
 * - Uses a dedicated server-side count endpoint for accurate counts (no pagination issues)
 * - Updates in real-time when tasks move in/out of review
 * - Skips updates when tab is hidden
 * - Only runs for logged-in users
 */
export function useDynamicFavicon() {
  const user = useAtomValue(userAtom);
  const previousCountRef = useRef<number>(-1);
  const updateVersionRef = useRef<number>(0);
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

  // Fetch review count from server using dedicated endpoint
  // This gets the accurate count across all threads without pagination issues
  const { data: reviewCount = 0, refetch } = useQuery({
    queryKey: ["review-count"],
    queryFn: async () => {
      return unwrapResult(await getReviewCountAction());
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds - matches thread list cache
    refetchOnWindowFocus: true,
  });

  // Debounce refetch to prevent flooding on rapid realtime events
  // 500ms delay coalesces multiple rapid status changes into a single refetch
  const debouncedRefetch = useDebouncedCallback(() => {
    refetch();
  }, 500);

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
      debouncedRefetch();
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

    // Increment version to handle race conditions with async updates
    const currentVersion = ++updateVersionRef.current;

    // Use the PNG favicon as base for canvas drawing
    const baseFaviconUrl = "/favicon.png";

    if (reviewCount === 0) {
      // Restore original favicon when count is 0
      restoreFavicon();
      previousCountRef.current = reviewCount;
    } else {
      // Draw favicon with badge
      drawFaviconWithBadge(baseFaviconUrl, reviewCount)
        .then((dataUrl) => {
          // Only update if this is still the latest version (prevents stale updates)
          if (updateVersionRef.current === currentVersion) {
            updateFavicon(dataUrl);
            previousCountRef.current = reviewCount;
          }
        })
        .catch((error) => {
          // Don't update previousCountRef on error so we can retry on next render
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
