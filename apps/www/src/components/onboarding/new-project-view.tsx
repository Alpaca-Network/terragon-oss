"use client";

import { useState } from "react";
import { ArrowLeft, Search, Sparkles, Github } from "lucide-react";
import { TEMPLATE_REPOS, type TemplateRepo } from "@/lib/template-repos";
import { CreateRepoDialog } from "./create-repo-dialog";
import { TemplateSearchDialog } from "./template-search-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NewProjectViewProps {
  onBack?: () => void;
  onRepoCreated?: () => void;
  className?: string;
}

function TemplateCard({
  template,
  onClick,
}: {
  template: TemplateRepo;
  onClick: () => void;
}) {
  const Icon = template.icon;

  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 p-4 transition-colors text-left"
    >
      <Icon className="h-6 w-6 text-primary mb-2" />
      <p className="text-sm font-medium">{template.name}</p>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
        {template.description}
      </p>
    </button>
  );
}

function SearchTemplateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-dashed border-border/50 bg-muted/10 hover:bg-muted/20 p-4 transition-colors text-left flex flex-col items-center justify-center"
    >
      <Search className="h-6 w-6 text-muted-foreground mb-2" />
      <p className="text-sm font-medium">Search Templates</p>
      <p className="text-xs text-muted-foreground mt-1 text-center">
        Find any GitHub template
      </p>
    </button>
  );
}

export function NewProjectView({
  onBack,
  onRepoCreated,
  className,
}: NewProjectViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRepo | null>(
    null,
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);

  const handleTemplateClick = (template: TemplateRepo) => {
    setSelectedTemplate(template);
    setShowCreateDialog(true);
  };

  const handleSearchClick = () => {
    setShowSearchDialog(true);
  };

  // Clear selectedTemplate when dialog closes to reset form state
  const handleCreateDialogOpenChange = (open: boolean) => {
    setShowCreateDialog(open);
    if (!open) {
      setSelectedTemplate(null);
    }
  };

  const handleRepoCreated = () => {
    setShowCreateDialog(false);
    setShowSearchDialog(false);
    setSelectedTemplate(null);
    onRepoCreated?.();
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 -ml-2"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-semibold">New Project</h2>
          <p className="text-xs text-muted-foreground">
            Create a new repository to get started
          </p>
        </div>
      </div>

      {/* Onboarding help section */}
      <div className="px-4 py-4 bg-gradient-to-br from-primary/5 to-primary/10 border-b">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium mb-1">
              Getting started with Terry
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pick a template below or search for any GitHub template. Terry
              will create your repository and automatically start working on
              your first task.
            </p>
          </div>
        </div>
      </div>

      {/* Templates section */}
      <div className="flex-1 overflow-auto px-4 py-4">
        <div className="space-y-4">
          {/* Popular Templates */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground/70">
              Popular Templates
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATE_REPOS.slice(0, 4).map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => handleTemplateClick(template)}
                />
              ))}
            </div>
          </div>

          {/* More Templates */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground/70">
              More Options
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATE_REPOS.slice(4).map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => handleTemplateClick(template)}
                />
              ))}
              <SearchTemplateCard onClick={handleSearchClick} />
            </div>
          </div>

          {/* Import existing repo hint */}
          <div className="mt-4 p-3 rounded-lg bg-muted/20 border border-border/30">
            <div className="flex items-start gap-2">
              <Github className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs font-medium">
                  Have an existing repository?
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Go back and select it from the repository dropdown in the task
                  form.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create repo dialog */}
      {selectedTemplate && (
        <CreateRepoDialog
          template={selectedTemplate}
          open={showCreateDialog}
          onOpenChange={handleCreateDialogOpenChange}
          onSuccess={handleRepoCreated}
        />
      )}

      {/* Template search dialog */}
      <TemplateSearchDialog
        open={showSearchDialog}
        onOpenChange={setShowSearchDialog}
        onSuccess={handleRepoCreated}
      />
    </div>
  );
}
