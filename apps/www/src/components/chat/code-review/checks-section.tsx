"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { PRCheckRun } from "@terragon/shared/db/types";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
  ExternalLink,
  AlertCircle,
  MinusCircle,
} from "lucide-react";

interface ChecksSectionProps {
  checks: PRCheckRun[];
}

export function ChecksSection({ checks }: ChecksSectionProps) {
  if (checks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Circle className="size-8 mb-2 opacity-50" />
        <p className="text-sm">No CI checks configured</p>
      </div>
    );
  }

  // Group checks by status
  const failing = checks.filter(
    (c) =>
      c.conclusion === "failure" ||
      c.conclusion === "timed_out" ||
      c.conclusion === "cancelled",
  );
  const pending = checks.filter(
    (c) => c.status === "queued" || c.status === "in_progress",
  );
  const passing = checks.filter(
    (c) =>
      c.conclusion === "success" ||
      c.conclusion === "neutral" ||
      c.conclusion === "skipped",
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="flex items-center gap-4 px-1 text-sm">
        {failing.length > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <XCircle className="size-4" />
            {failing.length} failing
          </span>
        )}
        {pending.length > 0 && (
          <span className="flex items-center gap-1 text-yellow-600">
            <Clock className="size-4" />
            {pending.length} pending
          </span>
        )}
        {passing.length > 0 && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="size-4" />
            {passing.length} passing
          </span>
        )}
      </div>

      {/* Check list */}
      <div className="flex flex-col gap-1">
        {/* Failing checks first */}
        {failing.map((check) => (
          <CheckItem key={check.id} check={check} />
        ))}
        {/* Then pending */}
        {pending.map((check) => (
          <CheckItem key={check.id} check={check} />
        ))}
        {/* Then passing */}
        {passing.map((check) => (
          <CheckItem key={check.id} check={check} />
        ))}
      </div>
    </div>
  );
}

function CheckItem({ check }: { check: PRCheckRun }) {
  const { icon, color } = getCheckStatusDisplay(check);

  return (
    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
      <div className={cn("flex-shrink-0", color)}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{check.name}</span>
          {check.detailsUrl && (
            <a
              href={check.detailsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        {check.output?.summary && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {check.output.summary}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 text-xs text-muted-foreground">
        {getCheckDuration(check)}
      </div>
    </div>
  );
}

function getCheckStatusDisplay(check: PRCheckRun): {
  icon: React.ReactNode;
  color: string;
} {
  if (check.status === "queued") {
    return {
      icon: <Clock className="size-4" />,
      color: "text-muted-foreground",
    };
  }

  if (check.status === "in_progress") {
    return {
      icon: <Clock className="size-4 animate-pulse" />,
      color: "text-yellow-600",
    };
  }

  switch (check.conclusion) {
    case "success":
      return {
        icon: <CheckCircle2 className="size-4" />,
        color: "text-green-600",
      };
    case "failure":
      return {
        icon: <XCircle className="size-4" />,
        color: "text-red-600",
      };
    case "timed_out":
      return {
        icon: <AlertCircle className="size-4" />,
        color: "text-red-600",
      };
    case "cancelled":
      return {
        icon: <MinusCircle className="size-4" />,
        color: "text-muted-foreground",
      };
    case "neutral":
    case "skipped":
      return {
        icon: <MinusCircle className="size-4" />,
        color: "text-muted-foreground",
      };
    default:
      return {
        icon: <Circle className="size-4" />,
        color: "text-muted-foreground",
      };
  }
}

function getCheckDuration(check: PRCheckRun): string {
  if (!check.startedAt) return "";

  const start = new Date(check.startedAt);
  const end = check.completedAt ? new Date(check.completedAt) : new Date();
  const durationMs = end.getTime() - start.getTime();
  const durationSec = Math.floor(durationMs / 1000);

  if (durationSec < 60) return `${durationSec}s`;
  const durationMin = Math.floor(durationSec / 60);
  if (durationMin < 60) return `${durationMin}m`;
  const durationHr = Math.floor(durationMin / 60);
  return `${durationHr}h ${durationMin % 60}m`;
}
