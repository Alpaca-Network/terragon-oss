"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { usePlatform } from "@/hooks/use-platform";
import { TemplateRepo } from "@/lib/template-repos";
import {
  createRepositoryFromTemplate,
  createBlankRepository,
} from "@/server-actions/create-repository";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAtomValue } from "jotai";
import {
  selectedModelAtom,
  selectedModelsPersistedAtom,
} from "@/atoms/user-flags";
import { useRouter } from "next/navigation";
import { unwrapResult } from "@/lib/server-actions";

interface CreateRepoDialogProps {
  template: TemplateRepo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateRepoDialog({
  template,
  open,
  onOpenChange,
  onSuccess,
}: CreateRepoDialogProps) {
  const [repoName, setRepoName] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [isPending, startTransition] = useTransition();
  const platform = usePlatform();
  const selectedModel = useAtomValue(selectedModelAtom);
  const selectedModels = useAtomValue(selectedModelsPersistedAtom);
  const router = useRouter();

  const handleCreate = () => {
    if (!repoName.trim()) {
      toast.error("Please enter a repository name");
      return;
    }

    startTransition(async () => {
      try {
        let result;

        if (template.id === "blank") {
          // Create blank repository
          result = await createBlankRepository({
            repoName: repoName.trim(),
            description: undefined,
            isPrivate,
            suggestedFirstTask: template.suggestedFirstTask,
            selectedModels: selectedModels || { primary: selectedModel },
          });
        } else {
          // Create from template
          if (!template.githubOwner || !template.githubRepo) {
            toast.error("Invalid template configuration");
            return;
          }

          result = await createRepositoryFromTemplate({
            templateOwner: template.githubOwner,
            templateRepo: template.githubRepo,
            repoName: repoName.trim(),
            isPrivate,
            suggestedFirstTask: template.suggestedFirstTask,
            selectedModels: selectedModels || { primary: selectedModel },
          });
        }

        const unwrapped = unwrapResult(result) as {
          repoFullName: string;
          threadId: string;
          message: string;
        };
        toast.success(unwrapped.message);
        onOpenChange(false);
        onSuccess?.();

        // Navigate to the new thread
        router.push(`/t/${unwrapped.threadId}`);
      } catch (error: any) {
        console.error("Failed to create repository:", error);
        toast.error(error.message || "Failed to create repository");
      }
    });
  };

  // Use Sheet on mobile, Dialog on desktop
  const Wrapper = platform === "mobile" ? Sheet : Dialog;
  const Content = platform === "mobile" ? SheetContent : DialogContent;
  const Header = platform === "mobile" ? SheetHeader : DialogHeader;
  const Title = platform === "mobile" ? SheetTitle : DialogTitle;
  const Description =
    platform === "mobile" ? SheetDescription : DialogDescription;

  return (
    <Wrapper open={open} onOpenChange={onOpenChange}>
      <Content>
        <Header>
          <Title>Create {template.name}</Title>
          <Description>{template.description}</Description>
        </Header>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="repo-name">Repository Name</Label>
            <Input
              id="repo-name"
              placeholder="my-awesome-project"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="private-repo"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={isPending}
            />
            <Label htmlFor="private-repo" className="cursor-pointer">
              Private repository
            </Label>
          </div>

          <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">What happens next?</p>
            <p>
              Your repository will be created and a task will automatically
              start to help you get started.
            </p>
          </div>

          <Button
            onClick={handleCreate}
            disabled={!repoName.trim() || isPending}
            className="w-full"
          >
            {isPending ? (
              <>
                <LoaderCircle className="animate-spin mr-2 h-4 w-4" />
                Creating...
              </>
            ) : (
              "Create Repository"
            )}
          </Button>
        </div>
      </Content>
    </Wrapper>
  );
}
