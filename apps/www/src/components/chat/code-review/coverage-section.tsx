"use client";

import React from "react";
import type { PRCheckRun } from "@terragon/shared/db/types";
import { COVERAGE_INTEGRATION_OPTIONS } from "@terragon/shared/github/pr-feedback";
import {
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  ExternalLink,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CoverageSectionProps {
  coverageCheck: PRCheckRun | null;
  onSuggestIntegration?: () => void;
}

export function CoverageSection({
  coverageCheck,
  onSuggestIntegration,
}: CoverageSectionProps) {
  if (!coverageCheck) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <BarChart3 className="size-8 mb-2 opacity-50" />
          <p className="text-sm mb-1">No coverage check detected</p>
          <p className="text-xs text-center max-w-xs">
            Coverage checks help ensure your code changes maintain test coverage
          </p>
        </div>

        {/* Suggest integration options */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="size-4 text-yellow-600" />
            <span className="text-sm font-medium">
              Consider adding coverage tracking
            </span>
          </div>
          <div className="grid gap-2">
            {COVERAGE_INTEGRATION_OPTIONS.map((option) => (
              <a
                key={option.name}
                href={option.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors group"
              >
                <div>
                  <span className="text-sm font-medium">{option.name}</span>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
                <ExternalLink className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
          {onSuggestIntegration && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={onSuggestIntegration}
            >
              <Lightbulb className="size-4 mr-2" />
              Create task to set up coverage
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { icon, color, statusText } = getCoverageStatus(coverageCheck);

  return (
    <div className="flex flex-col gap-4">
      {/* Coverage check status */}
      <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
        <div className={cn("flex-shrink-0", color)}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{coverageCheck.name}</span>
            {coverageCheck.detailsUrl && (
              <a
                href={coverageCheck.detailsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{statusText}</p>
        </div>
      </div>

      {/* Coverage output summary if available */}
      {coverageCheck.output?.summary && (
        <div className="p-3 rounded-lg border bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Summary
          </p>
          <p className="text-sm whitespace-pre-wrap">
            {coverageCheck.output.summary}
          </p>
        </div>
      )}

      {/* Link to detailed coverage report */}
      {coverageCheck.detailsUrl && (
        <a
          href={coverageCheck.detailsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 p-2 rounded-md border hover:bg-muted transition-colors text-sm"
        >
          <BarChart3 className="size-4" />
          View detailed coverage report
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}

function getCoverageStatus(check: PRCheckRun): {
  icon: React.ReactNode;
  color: string;
  statusText: string;
} {
  if (check.status === "queued" || check.status === "in_progress") {
    return {
      icon: <Clock className="size-5 animate-pulse" />,
      color: "text-yellow-600",
      statusText: "Coverage check in progress...",
    };
  }

  switch (check.conclusion) {
    case "success":
      return {
        icon: <CheckCircle2 className="size-5" />,
        color: "text-green-600",
        statusText: "Coverage check passed",
      };
    case "failure":
      return {
        icon: <XCircle className="size-5" />,
        color: "text-red-600",
        statusText: "Coverage decreased or below threshold",
      };
    default:
      return {
        icon: <BarChart3 className="size-5" />,
        color: "text-muted-foreground",
        statusText: check.output?.title || "Coverage check completed",
      };
  }
}
