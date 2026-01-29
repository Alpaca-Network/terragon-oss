"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import type { PRReviewThread } from "@terragon/shared/db/types";
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PRCommentsSectionProps {
  unresolved: PRReviewThread[];
  resolved: PRReviewThread[];
}

export function PRCommentsSection({
  unresolved,
  resolved,
}: PRCommentsSectionProps) {
  const [showResolved, setShowResolved] = useState(false);

  const totalUnresolved = unresolved.reduce(
    (acc, t) => acc + t.comments.length,
    0,
  );
  const totalResolved = resolved.reduce((acc, t) => acc + t.comments.length, 0);

  if (totalUnresolved === 0 && totalResolved === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <MessageSquare className="size-8 mb-2 opacity-50" />
        <p className="text-sm">No review comments</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Unresolved Comments */}
      {unresolved.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <MessageSquare className="size-4 text-yellow-600" />
            <span className="text-sm font-medium">
              Unresolved ({totalUnresolved})
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {unresolved.map((thread) => (
              <CommentThread key={thread.id} thread={thread} />
            ))}
          </div>
        </div>
      )}

      {/* Resolved Comments (collapsed by default) */}
      {resolved.length > 0 && (
        <Collapsible open={showResolved} onOpenChange={setShowResolved}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              {showResolved ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <CheckCircle2 className="size-4 text-green-600" />
              <span className="text-sm">Resolved ({totalResolved})</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-2 mt-2">
            {resolved.map((thread) => (
              <CommentThread key={thread.id} thread={thread} isResolved />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

interface CommentThreadProps {
  thread: PRReviewThread;
  isResolved?: boolean;
}

function CommentThread({ thread, isResolved }: CommentThreadProps) {
  const [expanded, setExpanded] = useState(!isResolved);
  const firstComment = thread.comments[0];
  const hasReplies = thread.comments.length > 1;

  if (!firstComment) return null;

  return (
    <div
      className={cn("rounded-lg border bg-card", isResolved && "opacity-70")}
    >
      {/* File path header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="size-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="size-4 flex-shrink-0" />
        )}
        <code className="text-xs font-mono text-muted-foreground truncate flex-1">
          {firstComment.path}
          {firstComment.line && `:${firstComment.line}`}
        </code>
        {hasReplies && (
          <span className="text-xs text-muted-foreground">
            {thread.comments.length} comments
          </span>
        )}
        <a
          href={firstComment.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </button>

      {/* Comments */}
      {expanded && (
        <div className="border-t">
          {thread.comments.map((comment, idx) => (
            <div
              key={comment.id}
              className={cn("p-3", idx > 0 && "border-t bg-muted/30")}
            >
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={comment.author.avatarUrl}
                  alt={comment.author.login}
                  className="size-5 rounded-full"
                />
                <span className="text-sm font-medium">
                  {comment.author.login}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(comment.createdAt)}
                </span>
              </div>
              <div className="text-sm text-foreground whitespace-pre-wrap pl-7">
                {comment.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
