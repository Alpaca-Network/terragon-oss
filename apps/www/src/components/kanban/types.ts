import { ThreadInfo, ThreadStatus } from "@terragon/shared";

export type KanbanColumn =
  | "backlog"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled";

export const KANBAN_COLUMNS: {
  id: KanbanColumn;
  title: string;
  description: string;
}[] = [
  {
    id: "backlog",
    title: "Backlog",
    description: "Tasks waiting to be started",
  },
  {
    id: "in_progress",
    title: "In Progress",
    description: "Tasks currently being worked on",
  },
  {
    id: "in_review",
    title: "In Review",
    description: "Tasks with open PRs awaiting review",
  },
  {
    id: "done",
    title: "Done",
    description: "Completed tasks",
  },
  {
    id: "cancelled",
    title: "Cancelled",
    description: "Cancelled or failed tasks",
  },
];

/**
 * Maps a thread's status and properties to a Kanban column
 */
export function getKanbanColumn(thread: ThreadInfo): KanbanColumn {
  const status = getCombinedStatus(thread);
  const hasOpenPR = thread.githubPRNumber && thread.prStatus === "open";
  const hasMergedPR = thread.prStatus === "merged";
  const hasPRChecksFailure = thread.prChecksStatus === "failure";

  // Error states go to cancelled
  if (status === "error" || status === "working-error") {
    return "cancelled";
  }

  // Stopped tasks go to cancelled
  if (status === "stopped" || status === "working-stopped") {
    return "cancelled";
  }

  // Draft and scheduled tasks go to backlog
  if (status === "draft" || status === "scheduled") {
    return "backlog";
  }

  // Queued tasks go to backlog
  if (
    status === "queued" ||
    status === "queued-tasks-concurrency" ||
    status === "queued-sandbox-creation-rate-limit" ||
    status === "queued-agent-rate-limit" ||
    status === "queued-blocked"
  ) {
    return "backlog";
  }

  // Active working tasks
  if (status === "booting" || status === "working") {
    return "in_progress";
  }

  // Finishing up tasks
  if (
    status === "stopping" ||
    status === "checkpointing" ||
    status === "working-done"
  ) {
    return "in_progress";
  }

  // Complete tasks
  if (status === "complete") {
    // If there's an open PR, it's in review
    if (hasOpenPR) {
      return "in_review";
    }
    // If PR was merged or checks passed, it's done
    if (hasMergedPR) {
      return "done";
    }
    // If PR checks failed, put in review (needs attention)
    if (hasPRChecksFailure) {
      return "in_review";
    }
    // No PR or closed PR means done
    return "done";
  }

  // Default fallback
  return "backlog";
}

/**
 * Gets the combined status from thread chats
 */
function getCombinedStatus(thread: ThreadInfo): ThreadStatus {
  const chatStatuses = thread.threadChats.map((chat) => chat.status);

  if (chatStatuses.length === 0) {
    return "queued";
  }

  // Priority order for combined status
  const priorityOrder: ThreadStatus[] = [
    "working-error",
    "error",
    "working",
    "booting",
    "stopping",
    "checkpointing",
    "working-done",
    "complete",
    "stopped",
    "working-stopped",
    "queued",
    "queued-tasks-concurrency",
    "queued-sandbox-creation-rate-limit",
    "queued-agent-rate-limit",
    "queued-blocked",
    "scheduled",
    "draft",
  ];

  for (const status of priorityOrder) {
    if (chatStatuses.includes(status)) {
      return status;
    }
  }

  // chatStatuses is guaranteed to have at least one element at this point
  // since we check for empty array above
  return chatStatuses[0]!;
}

export type KanbanThreadGroup = {
  column: KanbanColumn;
  threads: ThreadInfo[];
};
