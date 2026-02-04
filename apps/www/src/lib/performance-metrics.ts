"use client";

/**
 * Client-side performance metrics for measuring and reporting load times.
 * Uses Performance API for accurate timing and optionally reports to PostHog.
 */

type MetricName =
  | "task_drawer_open"
  | "thread_data_fetch"
  | "chat_ui_render"
  | "prefetch_thread"
  | "prefetch_threads_batch";

interface PerformanceMetric {
  name: MetricName;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, string | number | boolean>;
}

// Store active measurements
const activeMetrics = new Map<string, PerformanceMetric>();

// Store completed metrics for debugging (keep last 50)
const completedMetrics: PerformanceMetric[] = [];
const MAX_COMPLETED_METRICS = 50;

/**
 * Start measuring a performance metric.
 * @param name - The metric name
 * @param id - Optional unique identifier for concurrent measurements
 * @param metadata - Optional metadata to include with the metric
 */
export function startMetric(
  name: MetricName,
  id?: string,
  metadata?: Record<string, string | number | boolean>,
): string {
  const metricKey = id ? `${name}:${id}` : name;
  const metric: PerformanceMetric = {
    name,
    startTime: performance.now(),
    metadata,
  };
  activeMetrics.set(metricKey, metric);

  // Also use Performance API marks for DevTools visibility
  if (typeof performance?.mark === "function") {
    try {
      performance.mark(`${metricKey}:start`);
    } catch {
      // Ignore if mark fails (e.g., in SSR)
    }
  }

  return metricKey;
}

/**
 * End a performance measurement and optionally report it.
 * @param metricKey - The key returned from startMetric
 * @param additionalMetadata - Additional metadata to merge
 * @returns The duration in milliseconds, or null if metric wasn't found
 */
export function endMetric(
  metricKey: string,
  additionalMetadata?: Record<string, string | number | boolean>,
): number | null {
  const metric = activeMetrics.get(metricKey);
  if (!metric) {
    console.warn(`Performance metric not found: ${metricKey}`);
    return null;
  }

  metric.endTime = performance.now();
  metric.duration = metric.endTime - metric.startTime;

  if (additionalMetadata) {
    metric.metadata = { ...metric.metadata, ...additionalMetadata };
  }

  // Use Performance API measure for DevTools visibility
  if (typeof performance?.measure === "function") {
    try {
      performance.measure(metricKey, `${metricKey}:start`);
    } catch {
      // Ignore if measure fails
    }
  }

  // Store completed metric
  completedMetrics.push(metric);
  if (completedMetrics.length > MAX_COMPLETED_METRICS) {
    completedMetrics.shift();
  }

  // Remove from active metrics
  activeMetrics.delete(metricKey);

  // Log in development
  if (process.env.NODE_ENV === "development") {
    const roundedDuration = Math.round(metric.duration);
    const metadataStr = metric.metadata
      ? ` ${JSON.stringify(metric.metadata)}`
      : "";
    console.log(`[Perf] ${metric.name}: ${roundedDuration}ms${metadataStr}`);
  }

  return metric.duration;
}

/**
 * Cancel a metric measurement without recording it.
 */
export function cancelMetric(metricKey: string): void {
  activeMetrics.delete(metricKey);
}

/**
 * Get all completed metrics for debugging.
 */
export function getCompletedMetrics(): readonly PerformanceMetric[] {
  return completedMetrics;
}

/**
 * Clear all metrics (for testing).
 */
export function clearMetrics(): void {
  activeMetrics.clear();
  completedMetrics.length = 0;
}

/**
 * Get average duration for a metric type.
 */
export function getAverageDuration(name: MetricName): number | null {
  const metrics = completedMetrics.filter(
    (m) => m.name === name && m.duration !== undefined,
  );
  if (metrics.length === 0) return null;
  const total = metrics.reduce((sum, m) => sum + (m.duration ?? 0), 0);
  return total / metrics.length;
}

/**
 * Get P95 duration for a metric type.
 */
export function getP95Duration(name: MetricName): number | null {
  const metrics = completedMetrics
    .filter((m) => m.name === name && m.duration !== undefined)
    .map((m) => m.duration!)
    .sort((a, b) => a - b);

  if (metrics.length === 0) return null;
  const p95Index = Math.floor(metrics.length * 0.95);
  return metrics[p95Index] ?? metrics[metrics.length - 1]!;
}

/**
 * Hook to measure component render time.
 * Call in useEffect to measure time from component mount to effect execution.
 */
export function measureRenderTime(
  componentName: string,
  startTime: number,
): void {
  const duration = performance.now() - startTime;
  if (process.env.NODE_ENV === "development") {
    console.log(`[Perf] ${componentName} render: ${Math.round(duration)}ms`);
  }
}
