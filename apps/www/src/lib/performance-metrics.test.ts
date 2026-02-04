import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  startMetric,
  endMetric,
  cancelMetric,
  getCompletedMetrics,
  clearMetrics,
  getAverageDuration,
  getP95Duration,
} from "./performance-metrics";

describe("performance-metrics", () => {
  beforeEach(() => {
    clearMetrics();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("startMetric and endMetric", () => {
    it("should measure duration between start and end", async () => {
      const metricKey = startMetric("task_drawer_open");

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = endMetric(metricKey);

      expect(duration).not.toBeNull();
      expect(duration).toBeGreaterThanOrEqual(10);
    });

    it("should return null for unknown metric key", () => {
      const duration = endMetric("unknown-key");
      expect(duration).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        "Performance metric not found: unknown-key",
      );
    });

    it("should support custom IDs for concurrent measurements", () => {
      const key1 = startMetric("prefetch_thread", "thread-1");
      const key2 = startMetric("prefetch_thread", "thread-2");

      expect(key1).toBe("prefetch_thread:thread-1");
      expect(key2).toBe("prefetch_thread:thread-2");

      const duration1 = endMetric(key1);
      const duration2 = endMetric(key2);

      expect(duration1).not.toBeNull();
      expect(duration2).not.toBeNull();
    });

    it("should store metadata with the metric", () => {
      const metricKey = startMetric("thread_data_fetch", "test", {
        threadId: "abc123",
        cached: false,
      });

      endMetric(metricKey, { success: true });

      const metrics = getCompletedMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]?.metadata).toEqual({
        threadId: "abc123",
        cached: false,
        success: true,
      });
    });
  });

  describe("cancelMetric", () => {
    it("should remove metric without recording", () => {
      const metricKey = startMetric("task_drawer_open");
      cancelMetric(metricKey);

      const duration = endMetric(metricKey);
      expect(duration).toBeNull();
      expect(getCompletedMetrics()).toHaveLength(0);
    });
  });

  describe("getCompletedMetrics", () => {
    it("should return completed metrics in order", () => {
      const key1 = startMetric("task_drawer_open");
      endMetric(key1);

      const key2 = startMetric("thread_data_fetch");
      endMetric(key2);

      const metrics = getCompletedMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics[0]?.name).toBe("task_drawer_open");
      expect(metrics[1]?.name).toBe("thread_data_fetch");
    });

    it("should limit to MAX_COMPLETED_METRICS", () => {
      // Create more than 50 metrics
      for (let i = 0; i < 60; i++) {
        const key = startMetric("prefetch_thread", `thread-${i}`);
        endMetric(key);
      }

      const metrics = getCompletedMetrics();
      expect(metrics.length).toBe(50);
    });
  });

  describe("getAverageDuration", () => {
    it("should calculate average for completed metrics", () => {
      // Create metrics with known durations by mocking performance.now
      const originalNow = performance.now;
      let mockTime = 0;
      vi.spyOn(performance, "now").mockImplementation(() => {
        mockTime += 100; // Each call advances by 100ms
        return mockTime;
      });

      startMetric("task_drawer_open", "1");
      endMetric("task_drawer_open:1"); // 100ms

      startMetric("task_drawer_open", "2");
      endMetric("task_drawer_open:2"); // 100ms

      const avg = getAverageDuration("task_drawer_open");
      expect(avg).toBe(100);

      performance.now = originalNow;
    });

    it("should return null for unknown metric type", () => {
      expect(getAverageDuration("chat_ui_render")).toBeNull();
    });
  });

  describe("getP95Duration", () => {
    it("should calculate P95 duration", () => {
      // Mock performance.now to create predictable durations
      let mockTime = 0;
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      let callIndex = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        // Start calls return current time, end calls return time + duration
        if (callIndex % 2 === 0) {
          mockTime = callIndex * 1000;
        } else {
          mockTime += durations[Math.floor(callIndex / 2)]!;
        }
        callIndex++;
        return mockTime;
      });

      for (let i = 0; i < 10; i++) {
        const key = startMetric("task_drawer_open", `${i}`);
        endMetric(key);
      }

      const p95 = getP95Duration("task_drawer_open");
      // P95 of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] should be 100 (index 9)
      expect(p95).toBe(100);
    });

    it("should return null for unknown metric type", () => {
      expect(getP95Duration("chat_ui_render")).toBeNull();
    });
  });

  describe("clearMetrics", () => {
    it("should clear all metrics", () => {
      const key = startMetric("task_drawer_open");
      endMetric(key);

      expect(getCompletedMetrics()).toHaveLength(1);

      clearMetrics();

      expect(getCompletedMetrics()).toHaveLength(0);
    });
  });
});
