"use client";

import { useCallback, useEffect, useRef } from "react";

export interface UseLongPressOptions {
  threshold?: number; // Time in ms to trigger long press (default: 500)
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void;
  onPress?: () => void;
  disabled?: boolean;
}

export interface UseLongPressHandlers {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export function useLongPress({
  threshold = 500,
  onLongPress,
  onPress,
  disabled = false,
}: UseLongPressOptions): UseLongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clean up timer on unmount to prevent memory leaks and state updates on unmounted components
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (disabled) return;

      const touch = event.touches[0];
      if (!touch) return;

      startPosRef.current = { x: touch.clientX, y: touch.clientY };
      isLongPressRef.current = false;

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress(event);
      }, threshold);
    },
    [disabled, onLongPress, threshold],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (disabled) return;

      clearTimer();

      // If it was a long press, prevent the default action
      if (isLongPressRef.current) {
        event.preventDefault();
      } else if (onPress) {
        // It was a short tap
        onPress();
      }

      startPosRef.current = null;
    },
    [disabled, clearTimer, onPress],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (disabled || !startPosRef.current) return;

      const touch = event.touches[0];
      if (!touch) return;

      const moveThreshold = 10; // pixels

      // Cancel long press if user moves finger too much
      const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
      const deltaY = Math.abs(touch.clientY - startPosRef.current.y);

      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        clearTimer();
        startPosRef.current = null;
      }
    },
    [disabled, clearTimer],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (disabled) return;

      // Prevent default context menu and trigger our handler
      event.preventDefault();
      event.stopPropagation();
      onLongPress(event);
    },
    [disabled, onLongPress],
  );

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
    onContextMenu: handleContextMenu,
  };
}
