"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { TEMPLATE_REPOS, type TemplateRepo } from "@/lib/template-repos";
import { CreateRepoDialog } from "./create-repo-dialog";
import { TemplateSearchDialog } from "./template-search-dialog";

interface TemplateRepoSelectorProps {
  onRepoCreated?: () => void;
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

export function TemplateRepoSelector({
  onRepoCreated,
}: TemplateRepoSelectorProps) {
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

  const handleRepoCreated = () => {
    setShowCreateDialog(false);
    setShowSearchDialog(false);
    onRepoCreated?.();
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground/70">
        Start a New Project
      </h3>

      {/* Template cards - 2 cols on mobile, 3 cols on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {TEMPLATE_REPOS.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onClick={() => handleTemplateClick(template)}
          />
        ))}
        <SearchTemplateCard onClick={handleSearchClick} />
      </div>

      {/* Create repo dialog */}
      {selectedTemplate && (
        <CreateRepoDialog
          template={selectedTemplate}
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
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
