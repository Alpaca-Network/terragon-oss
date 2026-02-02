import { GitMerge, ExternalLink } from "lucide-react";
import { AddressFeedbackDialog } from "@/components/chat/code-review/address-feedback-dialog";
import { MergeButton } from "@/components/chat/code-review/merge-button";
import type { PRFeedback } from "@terragon/shared/db/types";
import type { ThreadInfoFull } from "@terragon/shared";

interface PRHeaderProps {
  feedback: PRFeedback;
  thread: ThreadInfoFull;
  onMerged: () => void;
}

export function PRHeader({ feedback, thread, onMerged }: PRHeaderProps) {
  return (
    <div className="border-b px-4 py-3 space-y-2 flex-shrink-0">
      <div className="flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GitMerge className="size-4 flex-shrink-0" />
          <a
            href={feedback.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:underline flex items-center gap-1 shrink-0"
          >
            #{feedback.prNumber}
            <ExternalLink className="size-3" />
          </a>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AddressFeedbackDialog feedback={feedback} thread={thread} />
          <MergeButton
            repoFullName={feedback.repoFullName}
            prNumber={feedback.prNumber}
            prTitle={feedback.prTitle}
            isMergeable={feedback.isMergeable}
            threadId={thread.id}
            onMerged={onMerged}
          />
        </div>
      </div>
      <div className="text-xs text-muted-foreground truncate">
        {feedback.prTitle}
      </div>
    </div>
  );
}
