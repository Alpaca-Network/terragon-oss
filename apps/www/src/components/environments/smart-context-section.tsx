"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Wand2 } from "lucide-react";
import { createEnvironment } from "@/server-actions/create-environment";
import { getEnvironments } from "@/server-actions/get-environments";
import { SmartContextEditor } from "./smart-context-editor";
import { cn } from "@/lib/utils";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/queries/server-action-helpers";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SmartContextSectionProps {
  repoFullName: string | null;
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * A collapsible Smart Context section for use in New Task dialog and similar views.
 * Automatically creates an environment if one doesn't exist for the selected repo.
 */
export function SmartContextSection({
  repoFullName,
  onDirtyChange,
}: SmartContextSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);

  // Fetch existing environments
  const { data: environments, isLoading: isLoadingEnvironments } =
    useServerActionQuery({
      queryKey: ["environments"],
      queryFn: getEnvironments,
      staleTime: 10 * 60 * 1000, // 10 minutes
      enabled: !!repoFullName,
    });

  // Create environment mutation
  const createEnvironmentMutation = useServerActionMutation({
    mutationFn: createEnvironment,
    onSuccess: (environment) => {
      setEnvironmentId(environment.id);
    },
  });

  // Find or create environment when repo changes
  useEffect(() => {
    if (!repoFullName || isLoadingEnvironments) {
      setEnvironmentId(null);
      return;
    }

    const existingEnv = environments?.find(
      (env) => env.repoFullName === repoFullName,
    );

    if (existingEnv) {
      setEnvironmentId(existingEnv.id);
    } else {
      setEnvironmentId(null);
    }
  }, [repoFullName, environments, isLoadingEnvironments]);

  // Create environment when section is opened and no environment exists
  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);

    if (
      open &&
      repoFullName &&
      !environmentId &&
      !createEnvironmentMutation.isPending
    ) {
      // Check if environment already exists (in case state is stale)
      const existingEnv = environments?.find(
        (env) => env.repoFullName === repoFullName,
      );
      if (!existingEnv) {
        await createEnvironmentMutation.mutateAsync({ repoFullName });
      }
    }
  };

  if (!repoFullName) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-2",
            isOpen && "text-foreground",
          )}
        >
          <Wand2 className="h-4 w-4" />
          <span>Smart Context</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 ml-auto transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {environmentId ? (
          <SmartContextEditor
            environmentId={environmentId}
            onDirtyChange={onDirtyChange}
          />
        ) : (
          <div className="text-sm text-muted-foreground py-4 text-center">
            {createEnvironmentMutation.isPending
              ? "Setting up environment..."
              : "Loading..."}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
