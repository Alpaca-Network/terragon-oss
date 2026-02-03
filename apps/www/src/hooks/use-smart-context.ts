import { useState, useCallback } from "react";
import { useJSONStream } from "./use-json-stream";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/queries/server-action-helpers";
import {
  getSmartContextAction,
  updateSmartContextAction,
} from "@/server-actions/smart-context";
import { AnalysisOutput } from "@/app/api/analyze-codebase/stream/route";

export type SmartContextStatus =
  | "idle"
  | "preparing"
  | "analyzing"
  | "completed"
  | "error";

export type UseSmartContextOptions = {
  environmentId: string;
  onAnalysisComplete?: (content: string) => void;
  onError?: (error: Error) => void;
};

type StreamMessage = {
  type: "progress" | "complete" | "error";
  output?: AnalysisOutput;
  data?: {
    content?: string;
    generatedAt?: string;
  };
  error?: string;
};

export function useSmartContext({
  environmentId,
  onAnalysisComplete,
  onError,
}: UseSmartContextOptions) {
  const [outputs, setOutputs] = useState<AnalysisOutput[]>([]);
  const [status, setStatus] = useState<SmartContextStatus>("idle");

  // Fetch existing smart context
  const {
    data: contextData,
    refetch,
    isLoading: isLoadingContext,
  } = useServerActionQuery({
    queryKey: ["smart-context", environmentId],
    queryFn: () => getSmartContextAction({ environmentId }),
  });

  // Save mutation
  const saveMutation = useServerActionMutation({
    mutationFn: updateSmartContextAction,
    onSuccess: () => {
      refetch();
    },
  });

  const addOutput = useCallback((output: AnalysisOutput) => {
    setOutputs((prev) => [...prev, output]);
  }, []);

  const clearOutputs = useCallback(() => {
    setOutputs([]);
  }, []);

  // JSON stream hook for analysis
  const {
    start: startStream,
    stop: stopStream,
    isStreaming,
    reset: resetStream,
  } = useJSONStream<StreamMessage>({
    url: `/api/analyze-codebase/stream`,
    body: { environmentId },
    onData: (streamData) => {
      if (streamData.type === "progress" && streamData.output) {
        addOutput(streamData.output);
        // Update status based on step
        if (
          streamData.output.step === "detecting" ||
          streamData.output.step === "reading"
        ) {
          setStatus("preparing");
        } else if (
          streamData.output.step === "analyzing" ||
          streamData.output.step === "generating"
        ) {
          setStatus("analyzing");
        }
      } else if (streamData.type === "complete") {
        setStatus("completed");
        // Refetch to get the saved context
        refetch();
        if (onAnalysisComplete && streamData.data?.content) {
          onAnalysisComplete(streamData.data.content);
        }
      } else if (streamData.type === "error") {
        setStatus("error");
        const error = new Error(streamData.error || "Analysis failed");
        if (onError) {
          onError(error);
        }
      }
    },
    onError: (error) => {
      setStatus("error");
      if (onError) {
        onError(error);
      }
    },
  });

  const analyze = useCallback(() => {
    clearOutputs();
    setStatus("preparing");
    startStream({ body: { environmentId } });
  }, [clearOutputs, startStream, environmentId]);

  const stop = useCallback(() => {
    stopStream();
    if (status === "preparing" || status === "analyzing") {
      setStatus("idle");
    }
  }, [stopStream, status]);

  const save = useCallback(
    async (content: string | null) => {
      await saveMutation.mutateAsync({
        environmentId,
        smartContext: content,
      });
    },
    [saveMutation, environmentId],
  );

  const reset = useCallback(() => {
    clearOutputs();
    setStatus("idle");
    resetStream();
  }, [clearOutputs, resetStream]);

  return {
    // Context data
    content: contextData?.content ?? null,
    generatedAt: contextData?.generatedAt ?? null,
    isLoadingContext,

    // Analysis state
    outputs,
    status,
    isAnalyzing:
      isStreaming || status === "preparing" || status === "analyzing",
    isCompleted: status === "completed",
    isError: status === "error",

    // Actions
    analyze,
    stop,
    save,
    reset,
    refetch,

    // Save state
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
  };
}
