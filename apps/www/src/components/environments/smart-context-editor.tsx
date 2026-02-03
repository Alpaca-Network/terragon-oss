"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2, Save, RotateCcw, Trash2 } from "lucide-react";
import { useSmartContext } from "@/hooks/use-smart-context";
import { SmartContextProgress } from "./smart-context-progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";

export function SmartContextEditor({
  environmentId,
  onDirtyChange,
}: {
  environmentId: string;
  onDirtyChange?: (isDirty: boolean) => void;
}) {
  const {
    content,
    generatedAt,
    isLoadingContext,
    outputs,
    isAnalyzing,
    analyze,
    save,
    isSaving,
  } = useSmartContext({
    environmentId,
    onAnalysisComplete: (newContent) => {
      setEditedContent(newContent);
      toast.success("Codebase analysis complete!");
    },
    onError: (error) => {
      toast.error(`Analysis failed: ${error.message}`);
    },
  });

  const [editedContent, setEditedContent] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  // Initialize edited content from fetched content
  useEffect(() => {
    if (!isInitialized && content !== null) {
      setEditedContent(content);
      setIsInitialized(true);
    } else if (!isInitialized && !isLoadingContext && content === null) {
      setEditedContent("");
      setIsInitialized(true);
    }
  }, [content, isLoadingContext, isInitialized]);

  const hasChanges = isInitialized && editedContent !== (content || "");

  // Notify parent of dirty state
  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  const handleSave = async () => {
    try {
      // Save empty string as null to clear, but preserve intentional empty content
      // by only treating empty string as "clear" when the user explicitly saves empty
      const contentToSave = editedContent.trim() === "" ? null : editedContent;
      await save(contentToSave);
      toast.success("Smart context saved successfully");
    } catch (error) {
      toast.error("Failed to save smart context");
    }
  };

  const handleAnalyze = () => {
    // If there are unsaved changes, show confirmation dialog
    if (hasChanges) {
      setShowRegenerateDialog(true);
    } else {
      analyze();
    }
  };

  const handleConfirmRegenerate = () => {
    setShowRegenerateDialog(false);
    analyze();
  };

  const handleClear = async () => {
    try {
      await save(null);
      setEditedContent("");
      setShowClearDialog(false);
      toast.success("Smart context cleared");
    } catch (error) {
      toast.error("Failed to clear smart context");
    }
  };

  const handleReset = () => {
    setEditedContent(content || "");
  };

  const formattedDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Header with actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          {formattedDate && (
            <p className="text-xs text-muted-foreground">
              Last generated: {formattedDate}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isSaving || isAnalyzing}
              className="text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
          )}
          {content && (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={isSaving || isAnalyzing}
                className="text-xs text-destructive hover:text-destructive"
                onClick={() => setShowClearDialog(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
              <DeleteConfirmationDialog
                open={showClearDialog}
                onOpenChange={setShowClearDialog}
                onConfirm={handleClear}
                title="Clear Smart Context?"
                description="This will remove the generated context. You can regenerate it at any time by clicking 'Analyze Codebase'."
                confirmText="Clear"
                isLoading={isSaving}
              />
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyze}
            disabled={isAnalyzing || isSaving}
            className="text-xs"
          >
            {isAnalyzing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5 mr-1" />
            )}
            {content ? "Regenerate" : "Analyze Codebase"}
          </Button>
          <DeleteConfirmationDialog
            open={showRegenerateDialog}
            onOpenChange={setShowRegenerateDialog}
            onConfirm={handleConfirmRegenerate}
            title="Discard unsaved changes?"
            description="You have unsaved changes to the smart context. Regenerating will replace your current edits with new content."
            confirmText="Regenerate"
            isLoading={false}
          />
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || isAnalyzing}
              className="text-xs"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Progress indicator during analysis */}
      {isAnalyzing && (
        <SmartContextProgress outputs={outputs} isAnalyzing={isAnalyzing} />
      )}

      {/* Editor */}
      <Textarea
        value={editedContent}
        onChange={(e) => setEditedContent(e.target.value)}
        placeholder={
          isLoadingContext
            ? "Loading..."
            : "Click 'Analyze Codebase' to generate context based on your project's tech stack, structure, and conventions.\n\nAlternatively, you can write your own context here."
        }
        className={cn(
          "font-mono text-sm min-h-[250px] resize-y",
          isAnalyzing && "opacity-50",
        )}
        disabled={isAnalyzing || isLoadingContext}
      />

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        This context is automatically injected into every agent session for this
        repository. It helps the AI understand your project&apos;s conventions
        and patterns.
      </p>
    </div>
  );
}
