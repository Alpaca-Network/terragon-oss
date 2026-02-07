import { describe, expect, it } from "vitest";
import {
  getGithubPRStatus,
  getGithubPRChecksStatus,
  getGithubPRMergeableState,
} from "./helpers";

describe("getGithubPRStatus", () => {
  it("should return 'open' for open non-draft PR", () => {
    const pr = {
      draft: false,
      closed_at: null,
      merged_at: null,
    };
    expect(getGithubPRStatus(pr)).toBe("open");
  });

  it("should return 'draft' for open draft PR", () => {
    const pr = {
      draft: true,
      closed_at: null,
      merged_at: null,
    };
    expect(getGithubPRStatus(pr)).toBe("draft");
  });

  it("should return 'merged' for merged PR", () => {
    const pr = {
      draft: false,
      closed_at: "2024-01-01T00:00:00Z",
      merged_at: "2024-01-01T00:00:00Z",
    };
    expect(getGithubPRStatus(pr)).toBe("merged");
  });

  it("should return 'closed' for closed non-draft PR", () => {
    const pr = {
      draft: false,
      closed_at: "2024-01-01T00:00:00Z",
      merged_at: null,
    };
    expect(getGithubPRStatus(pr)).toBe("closed");
  });

  it("should return 'closed' for closed draft PR (not 'draft')", () => {
    const pr = {
      draft: true,
      closed_at: "2024-01-01T00:00:00Z",
      merged_at: null,
    };
    expect(getGithubPRStatus(pr)).toBe("closed");
  });

  it("should return 'merged' for merged draft PR (not 'draft')", () => {
    const pr = {
      draft: true,
      closed_at: "2024-01-01T00:00:00Z",
      merged_at: "2024-01-01T00:00:00Z",
    };
    expect(getGithubPRStatus(pr)).toBe("merged");
  });
});

describe("getGithubPRChecksStatus", () => {
  type CheckStatus =
    | "queued"
    | "in_progress"
    | "completed"
    | "pending"
    | "requested"
    | "waiting";
  type CheckConclusion =
    | "success"
    | "failure"
    | "neutral"
    | "cancelled"
    | "skipped"
    | "timed_out"
    | "action_required"
    | null;

  const createCheckRun = (
    status: CheckStatus,
    conclusion: CheckConclusion,
  ) => ({
    status,
    conclusion,
    id: 1,
    name: "Test Check",
    started_at: "2024-01-01T00:00:00Z",
    completed_at: conclusion ? "2024-01-01T00:01:00Z" : null,
    details_url: "https://example.com",
    head_sha: "abc123",
    html_url: "https://github.com",
    node_id: "node1",
    external_id: "ext1",
    url: "https://api.github.com",
    check_suite: null as any,
    app: null as any,
    pull_requests: [],
    output: {
      title: null,
      summary: null,
      text: null,
      annotations_count: 0,
      annotations_url: "",
    },
  });

  it("should return 'none' when no checks exist", () => {
    const checks = { total_count: 0, check_runs: [] };
    expect(getGithubPRChecksStatus(checks)).toBe("none");
  });

  it("should return 'pending' when some checks are queued", () => {
    const checks = {
      total_count: 2,
      check_runs: [
        createCheckRun("completed", "success"),
        createCheckRun("queued", null),
      ],
    };
    expect(getGithubPRChecksStatus(checks)).toBe("pending");
  });

  it("should return 'pending' when some checks are in_progress", () => {
    const checks = {
      total_count: 2,
      check_runs: [
        createCheckRun("completed", "success"),
        createCheckRun("in_progress", null),
      ],
    };
    expect(getGithubPRChecksStatus(checks)).toBe("pending");
  });

  it("should return 'failure' when any check has failed", () => {
    const checks = {
      total_count: 2,
      check_runs: [
        createCheckRun("completed", "success"),
        createCheckRun("completed", "failure"),
      ],
    };
    expect(getGithubPRChecksStatus(checks)).toBe("failure");
  });

  it("should return 'failure' when any check has timed_out", () => {
    const checks = {
      total_count: 2,
      check_runs: [
        createCheckRun("completed", "success"),
        createCheckRun("completed", "timed_out"),
      ],
    };
    expect(getGithubPRChecksStatus(checks)).toBe("failure");
  });

  it("should return 'failure' when any check is cancelled", () => {
    const checks = {
      total_count: 2,
      check_runs: [
        createCheckRun("completed", "success"),
        createCheckRun("completed", "cancelled"),
      ],
    };
    expect(getGithubPRChecksStatus(checks)).toBe("failure");
  });

  it("should return 'success' when all checks pass", () => {
    const checks = {
      total_count: 3,
      check_runs: [
        createCheckRun("completed", "success"),
        createCheckRun("completed", "success"),
        createCheckRun("completed", "success"),
      ],
    };
    expect(getGithubPRChecksStatus(checks)).toBe("success");
  });

  it("should return 'success' when checks are success, neutral, or skipped", () => {
    const checks = {
      total_count: 3,
      check_runs: [
        createCheckRun("completed", "success"),
        createCheckRun("completed", "neutral"),
        createCheckRun("completed", "skipped"),
      ],
    };
    expect(getGithubPRChecksStatus(checks)).toBe("success");
  });

  it("should return 'unknown' for unexpected conclusion values", () => {
    const checks = {
      total_count: 2,
      check_runs: [
        createCheckRun("completed", "success"),
        createCheckRun("completed", "action_required"),
      ],
    };
    expect(getGithubPRChecksStatus(checks)).toBe("unknown");
  });
});

describe("getGithubPRMergeableState", () => {
  it("should return 'clean' for clean mergeable state", () => {
    expect(getGithubPRMergeableState({ mergeable_state: "clean" })).toBe(
      "clean",
    );
  });

  it("should return 'dirty' for dirty mergeable state (conflicts)", () => {
    expect(getGithubPRMergeableState({ mergeable_state: "dirty" })).toBe(
      "dirty",
    );
  });

  it("should return 'blocked' for blocked mergeable state", () => {
    expect(getGithubPRMergeableState({ mergeable_state: "blocked" })).toBe(
      "blocked",
    );
  });

  it("should return 'unstable' for unstable mergeable state", () => {
    expect(getGithubPRMergeableState({ mergeable_state: "unstable" })).toBe(
      "unstable",
    );
  });

  it("should return 'unknown' for unknown mergeable state", () => {
    expect(getGithubPRMergeableState({ mergeable_state: "unknown" })).toBe(
      "unknown",
    );
  });

  it("should return 'unknown' for unexpected mergeable state", () => {
    expect(
      getGithubPRMergeableState({ mergeable_state: "something_else" }),
    ).toBe("unknown");
  });
});
