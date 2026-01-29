"use client";

import { MessageCircle } from "lucide-react";
import { useServerActionQuery } from "@/queries/server-action-helpers";
import { getPRFeedback } from "@/server-actions/get-pr-feedback";
import { createFeedbackSummary } from "@terragon/shared/github/pr-feedback";
import { cn } from "@/lib/utils";

interface PRCommentCountBadgeProps {
  threadId: string;
  repoFullName: string | null;
  prNumber: number | null;
  onClick?: (e: React.MouseEvent) => void;
}

export function PRCommentCountBadge({
  threadId,
  repoFullName,
  prNumber,
  onClick,
}: PRCommentCountBadgeProps) {
  const { data, isLoading } = useServerActionQuery({
    queryKey: ["pr-feedback-summary", threadId],
    queryFn: () => getPRFeedback({ threadId }),
    enabled: !!repoFullName && !!prNumber,
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // Refetch every 2 minutes
  });

  // Don't render anything if no PR or still loading
  if (!repoFullName || !prNumber || isLoading || !data) {
    return null;
  }

  const summary = createFeedbackSummary(data.feedback);
  const commentCount = summary.unresolvedCommentCount;

  // Don't show badge if no unresolved comments
  if (commentCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs",
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
        "hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors",
        "cursor-pointer",
      )}
      title={`${commentCount} unresolved PR comment${commentCount !== 1 ? "s" : ""}`}
    >
      <MessageCircle className="size-3" />
      <span>{commentCount}</span>
    </button>
  );
}
