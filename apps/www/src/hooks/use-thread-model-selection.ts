import { useAtom } from "jotai";
import { selectedModelAtom } from "@/atoms/user-flags";
import { AIModel } from "@terragon/agent/types";
import { useEffect, useMemo } from "react";

/**
 * Hook to manage per-thread model selection.
 * This hook initializes the selected model from the thread's lastUsedModel
 * and keeps it in sync with the global selectedModelAtom.
 *
 * The model selection is stored in localStorage (via atoms) per thread,
 * allowing users to switch models mid-task and have the selection persist
 * across page reloads.
 */
export function useThreadModelSelection({
  threadId,
  threadChatId,
  lastUsedModel,
}: {
  threadId: string | null;
  threadChatId: string | null;
  lastUsedModel: AIModel | null | undefined;
}) {
  const [selectedModel, setSelectedModel] = useAtom(selectedModelAtom);

  // Initialize the selected model from thread's lastUsedModel on mount
  useEffect(() => {
    if (lastUsedModel && threadId && threadChatId) {
      setSelectedModel(lastUsedModel);
    }
  }, [threadId, threadChatId, lastUsedModel, setSelectedModel]);

  // Return the current selected model for this thread
  return useMemo(
    () => ({
      selectedModel: lastUsedModel || selectedModel,
    }),
    [lastUsedModel, selectedModel],
  );
}
