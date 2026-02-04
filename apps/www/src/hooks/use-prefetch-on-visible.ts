"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { threadQueryOptions } from "@/queries/thread-queries";

/**
 * Prefetches thread data when an element becomes visible in the viewport.
 * Uses Intersection Observer for efficient visibility detection.
 * This is more aggressive than hover-based prefetching since it triggers
 * before user interaction.
 */
export function usePrefetchOnVisible(threadId: string) {
  const queryClient = useQueryClient();
  const hasPrefetchedRef = useRef(false);
  const elementRef = useRef<HTMLElement | null>(null);

  const prefetch = useCallback(() => {
    if (hasPrefetchedRef.current) return;
    hasPrefetchedRef.current = true;

    // Check if already in cache
    const existingData = queryClient.getQueryData(
      threadQueryOptions(threadId).queryKey,
    );
    if (existingData) return;

    queryClient.prefetchQuery(threadQueryOptions(threadId)).catch((error) => {
      console.error(`Error prefetching thread ${threadId} on visible:`, error);
      // Reset so we can retry
      hasPrefetchedRef.current = false;
    });
  }, [queryClient, threadId]);

  const setRef = useCallback(
    (element: HTMLElement | null) => {
      // Clean up previous observer and callback
      if (elementRef.current) {
        observerInstance?.unobserve(elementRef.current);
        observerCallbacks.delete(elementRef.current);
      }

      elementRef.current = element;

      if (!element) return;

      // Use shared Intersection Observer for better performance
      if (!observerInstance) {
        observerInstance = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const callback = observerCallbacks.get(entry.target);
                callback?.();
              }
            });
          },
          {
            // Start prefetching when element is 50% visible or within 200px of viewport
            rootMargin: "200px",
            threshold: 0.5,
          },
        );
      }

      observerCallbacks.set(element, prefetch);
      observerInstance.observe(element);
    },
    [prefetch],
  );

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (elementRef.current) {
        observerInstance?.unobserve(elementRef.current);
        observerCallbacks.delete(elementRef.current);
      }
    };
  }, []);

  return setRef;
}

// Shared Intersection Observer instance for better performance
let observerInstance: IntersectionObserver | null = null;
const observerCallbacks = new Map<Element, () => void>();
