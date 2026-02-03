import { describe, expect, it } from "vitest";
import {
  getMergeablePollingInterval,
  nextMergeablePollingState,
  MERGEABLE_POLL_INTERVAL_MS,
  MERGEABLE_POLL_WINDOW_MS,
} from "./mergeable-polling";

describe("mergeable polling helpers", () => {
  it("starts polling window on unknown mergeable state", () => {
    const now = 1_000_000;
    const state = nextMergeablePollingState({
      mergeableState: "unknown",
      now,
      state: { until: null, count: 0 },
    });

    expect(state.count).toBe(1);
    expect(state.until).toBe(now + MERGEABLE_POLL_WINDOW_MS);
  });

  it("increments polling attempts while unknown", () => {
    const now = 1_000_000;
    const state = nextMergeablePollingState({
      mergeableState: "unknown",
      now,
      state: { until: now + MERGEABLE_POLL_WINDOW_MS, count: 3 },
    });

    expect(state.count).toBe(4);
    expect(state.until).toBe(now + MERGEABLE_POLL_WINDOW_MS);
  });

  it("does not increment polling attempts without a refetch", () => {
    const now = 1_000_000;
    const state = nextMergeablePollingState({
      mergeableState: "unknown",
      now,
      state: { until: now + MERGEABLE_POLL_WINDOW_MS, count: 3 },
      didRefetch: false,
    });

    expect(state.count).toBe(3);
    expect(state.until).toBe(now + MERGEABLE_POLL_WINDOW_MS);
  });

  it("resets polling state when mergeable becomes known", () => {
    const state = nextMergeablePollingState({
      mergeableState: "clean",
      now: 1_000_000,
      state: { until: 1_005_000, count: 4 },
    });

    expect(state).toEqual({ until: null, count: 0 });
  });

  it("returns fast interval while within polling window", () => {
    const now = 1_000_000;
    const interval = getMergeablePollingInterval({
      mergeableState: "unknown",
      now,
      state: { until: now + MERGEABLE_POLL_WINDOW_MS, count: 2 },
      defaultIntervalMs: 60000,
    });

    expect(interval).toBe(MERGEABLE_POLL_INTERVAL_MS);
  });

  it("returns default interval when not polling", () => {
    const interval = getMergeablePollingInterval({
      mergeableState: "clean",
      now: 1_000_000,
      state: { until: null, count: 0 },
      defaultIntervalMs: 60000,
    });

    expect(interval).toBe(60000);
  });
});
