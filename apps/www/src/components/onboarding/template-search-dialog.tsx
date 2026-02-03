"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Search, Star, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { usePlatform } from "@/hooks/use-platform";
import {
  searchGitHubTemplate,
  createRepositoryFromTemplate,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAtomValue } from "jotai";
import {
  selectedModelAtom,
  selectedModelsPersistedAtom,
} from "@/atoms/user-flags";
import { useRouter } from "next/navigation";
import { unwrapResult } from "@/lib/server-actions";

interface TemplateSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface SearchResult {
  full_name: string;
  name: string;
  description: string | null;
  owner: string;
  stargazers_count: number;
  language: string | null;
  is_template: boolean | null;
}

export function TemplateSearchDialog({
  open,
  onOpenChange,
  onSuccess,
}: TemplateSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    null,
  );
  const [repoName, setRepoName] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [isSearching, startSearchTransition] = useTransition();
  const [isCreating, startCreateTransition] = useTransition();
  const platform = usePlatform();
  const selectedModel = useAtomValue(selectedModelAtom);
  const selectedModels = useAtomValue(selectedModelsPersistedAtom);
  const router = useRouter();

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    startSearchTransition(async () => {
      try {
        const result = await searchGitHubTemplate({
          query: searchQuery.trim(),
        });
        const unwrapped = unwrapResult(result) as {
          repos: Array<{
            full_name: string;
            name: string;
            description: string | null;
            owner: string;
            stargazers_count: number;
            language: string | null;
            is_template: boolean | null;
          }>;
        };
        setSearchResults(unwrapped.repos);

        if (unwrapped.repos.length === 0) {
          toast.info("No templates found. Try a different search query.");
        }
      } catch (error: any) {
        console.error("Failed to search templates:", error);
        toast.error(error.message || "Failed to search templates");
      }
    });
  };

  const handleSelectTemplate = (result: SearchResult) => {
    setSelectedResult(result);
    setRepoName(""); // Reset repo name
  };

  const handleBack = () => {
    setSelectedResult(null);
    setRepoName("");
  };

  const handleCreate = () => {
    if (!selectedResult) return;
    if (!repoName.trim()) {
      toast.error("Please enter a repository name");
      return;
    }

    const parts = selectedResult.full_name.split("/");
    const owner = parts[0];
    const repo = parts[1];

    if (!owner || !repo) {
      toast.error("Invalid repository format");
      return;
    }

    startCreateTransition(async () => {
      try {
        const result = await createRepositoryFromTemplate({
          templateOwner: owner,
          templateRepo: repo,
          repoName: repoName.trim(),
          isPrivate,
          suggestedFirstTask:
            "Review this project and help me customize it for my needs",
          selectedModels: selectedModels || { primary: selectedModel },
        });

        const unwrapped = unwrapResult(result) as {
          repoFullName: string;
          threadId: string;
          message: string;
        };
        toast.success(unwrapped.message);
        onOpenChange(false);
        onSuccess?.();

        // Reset state
        setSearchQuery("");
        setSearchResults([]);
        setSelectedResult(null);
        setRepoName("");

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
      <Content className="max-h-[85vh]">
        <Header>
          <Title>
            {selectedResult ? "Create from Template" : "Search Templates"}
          </Title>
          <Description>
            {selectedResult
              ? `Create a new repository from ${selectedResult.full_name}`
              : "Search for any GitHub template repository"}
          </Description>
        </Header>

        {!selectedResult ? (
          // Search view
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="search-query">Repository or Owner/Repo</Label>
              <div className="flex gap-2">
                <Input
                  id="search-query"
                  placeholder="e.g., nextjs-template or vercel/next.js"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  disabled={isSearching}
                  autoFocus
                />
                <Button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                >
                  {isSearching ? (
                    <LoaderCircle className="animate-spin h-4 w-4" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <ScrollArea className="h-[300px] rounded-lg border border-border/50">
                <div className="space-y-2 p-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.full_name}
                      onClick={() => handleSelectTemplate(result)}
                      className="w-full rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 p-3 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {result.full_name}
                          </p>
                          {result.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {result.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3" />
                              {result.stargazers_count.toLocaleString()}
                            </div>
                            {result.language && (
                              <span className="text-xs bg-primary/10 rounded px-1.5 py-0.5">
                                {result.language}
                              </span>
                            )}
                            {result.is_template && (
                              <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 rounded px-1.5 py-0.5">
                                Template
                              </span>
                            )}
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : (
          // Create view
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="repo-name">Repository Name</Label>
              <Input
                id="repo-name"
                placeholder="my-awesome-project"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="private-repo"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
                disabled={isCreating}
              />
              <Label htmlFor="private-repo" className="cursor-pointer">
                Private repository
              </Label>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">
                Template: {selectedResult.name}
              </p>
              {selectedResult.description && (
                <p className="text-muted-foreground text-xs">
                  {selectedResult.description}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isCreating}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!repoName.trim() || isCreating}
                className="flex-1"
              >
                {isCreating ? (
                  <>
                    <LoaderCircle className="animate-spin mr-2 h-4 w-4" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        )}
      </Content>
    </Wrapper>
  );
}
