import type { GithubPRMergeableState } from "@terragon/shared/db/types";

export const MERGEABLE_POLL_INTERVAL_MS = 5000;
export const MERGEABLE_POLL_WINDOW_MS = 60000;
export const MERGEABLE_POLL_MAX_ATTEMPTS = 12;

export type MergeablePollingState = {
  until: number | null;
  count: number;
};

export function getMergeablePollingInterval({
  mergeableState,
  now,
  state,
  defaultIntervalMs,
}: {
  mergeableState: GithubPRMergeableState | undefined;
  now: number;
  state: MergeablePollingState;
  defaultIntervalMs: number;
}) {
  if (
    mergeableState === "unknown" &&
    state.until !== null &&
    now < state.until &&
    state.count < MERGEABLE_POLL_MAX_ATTEMPTS
  ) {
    return MERGEABLE_POLL_INTERVAL_MS;
  }

  return defaultIntervalMs;
}

export function nextMergeablePollingState({
  mergeableState,
  now,
  state,
  didRefetch = true,
}: {
  mergeableState: GithubPRMergeableState | undefined;
  now: number;
  state: MergeablePollingState;
  didRefetch?: boolean;
}): MergeablePollingState {
  if (mergeableState !== "unknown") {
    if (state.until === null && state.count === 0) {
      return state;
    }
    return { until: null, count: 0 };
  }

  if (!didRefetch) {
    return state;
  }

  if (state.until === null) {
    return {
      until: now + MERGEABLE_POLL_WINDOW_MS,
      count: 1,
    };
  }

  return {
    until: state.until,
    count: state.count + 1,
  };
}
