"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { AnalysisOutput } from "@/app/api/analyze-codebase/stream/route";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Search,
  FileSearch,
  Sparkles,
  FileText,
  Package,
} from "lucide-react";

const STEP_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  preparing: Package,
  creating: Package,
  created: Package,
  detecting: Search,
  reading: FileSearch,
  analyzing: Sparkles,
  generating: FileText,
  saving: FileText,
  cleanup: Package,
  complete: CheckCircle2,
};

const STEP_LABELS: Record<string, string> = {
  preparing: "Preparing",
  creating: "Creating Sandbox",
  created: "Sandbox Ready",
  detecting: "Detecting Stack",
  reading: "Reading Files",
  analyzing: "AI Analysis",
  generating: "Generating Context",
  saving: "Saving",
  cleanup: "Cleaning Up",
  complete: "Complete",
};

export function SmartContextProgress({
  outputs,
  isAnalyzing,
}: {
  outputs: AnalysisOutput[];
  isAnalyzing: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new output is added
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [outputs]);

  if (outputs.length === 0 && !isAnalyzing) {
    return null;
  }

  // Get unique steps for progress indicator
  const steps = outputs.reduce((acc, output) => {
    if (!acc.find((s) => s.step === output.step)) {
      acc.push(output);
    }
    return acc;
  }, [] as AnalysisOutput[]);

  const currentStep = outputs[outputs.length - 1]?.step;

  return (
    <div className="border rounded-md bg-muted/30 overflow-hidden">
      {/* Progress steps */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50 overflow-x-auto">
        {steps.map((output, index) => {
          const Icon = STEP_ICONS[output.step] || Circle;
          const isActive = output.step === currentStep && isAnalyzing;
          const isComplete =
            index < steps.length - 1 ||
            (output.step === "complete" && !isAnalyzing);

          return (
            <div
              key={output.step}
              className={cn(
                "flex items-center gap-1.5 text-xs whitespace-nowrap",
                isComplete && "text-muted-foreground",
                isActive && "text-primary font-medium",
                !isComplete && !isActive && "text-muted-foreground/60",
              )}
            >
              {isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isComplete ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span>{STEP_LABELS[output.step] || output.step}</span>
              {index < steps.length - 1 && (
                <span className="text-muted-foreground/40 ml-1">→</span>
              )}
            </div>
          );
        })}
        {isAnalyzing && steps.length === 0 && (
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Starting analysis...</span>
          </div>
        )}
      </div>

      {/* Detailed log */}
      <div className="p-3 max-h-40 overflow-y-auto font-mono text-xs space-y-1">
        {outputs.map((output, index) => (
          <div
            key={index}
            className={cn(
              "flex items-start gap-2",
              output.step === "complete"
                ? "text-green-600 dark:text-green-400"
                : "text-muted-foreground",
            )}
          >
            <span className="text-muted-foreground/60 shrink-0">
              [{STEP_LABELS[output.step] || output.step}]
            </span>
            <span>{output.message}</span>
          </div>
        ))}
        {isAnalyzing && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
