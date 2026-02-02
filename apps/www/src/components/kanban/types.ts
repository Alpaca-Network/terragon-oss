import { ThreadInfo, ThreadStatus } from "@terragon/shared";

export type KanbanColumn =
  | "backlog"
  | "in_progress"
  | "in_review"
  | "done"
  | "failed";

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
    title: "Review",
    description: "Tasks awaiting review or with open PRs",
  },
  {
    id: "done",
    title: "Done",
    description: "Completed tasks",
  },
  {
    id: "failed",
    title: "Failed",
    description: "Failed or cancelled tasks",
  },
];

/**
 * Maps a thread's status and properties to a Kanban column
 */
export function getKanbanColumn(thread: ThreadInfo): KanbanColumn {
  const status = getCombinedStatus(thread);
  const hasMergedPR = thread.prStatus === "merged";

  // Tasks explicitly marked as backlog go to backlog column
  if (thread.isBacklog) {
    return "backlog";
  }

  // Error states go to failed
  if (status === "error" || status === "working-error") {
    return "failed";
  }

  // Stopped tasks go to failed
  if (status === "stopped" || status === "working-stopped") {
    return "failed";
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
    // If PR was merged, it's done
    if (hasMergedPR) {
      return "done";
    }
    // All other complete tasks go to review (open PR, no PR, or checks failed)
    return "in_review";
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

/**
 * Checks if a thread has an error status (error or working-error)
 */
export function isErrorThread(thread: ThreadInfo): boolean {
  const status = getCombinedStatus(thread);
  return status === "error" || status === "working-error";
}

/**
 * Checks if a thread is a draft (can be started)
 */
export function isDraftThread(thread: ThreadInfo): boolean {
  if (thread.threadChats.length === 0) {
    return false;
  }
  // A thread is a draft if all its chats have status "draft"
  return thread.threadChats.every((chat) => chat.status === "draft");
}
