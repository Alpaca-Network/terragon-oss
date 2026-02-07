"use client";

import { Star } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useSetAtom } from "jotai";
import { selectedRepoAtom, selectedBranchAtom } from "@/atoms/user-flags";
import { UserRepo } from "@/server-actions/user-repos";

interface RecentReposQuickAccessProps {
  repos: UserRepo[];
  onTaskSelect: (prompt: string) => void;
}

function RepoQuickAccessCard({
  repo,
  onClick,
}: {
  repo: UserRepo;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-32 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 p-3 transition-colors"
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium truncate" title={repo.name}>
          {repo.name}
        </p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3" />
          {repo.stargazers_count || 0}
        </div>
        {repo.language && (
          <span className="text-xs bg-primary/10 rounded px-1.5 py-0.5 truncate">
            {repo.language}
          </span>
        )}
      </div>
    </button>
  );
}

export function RecentReposQuickAccess({
  repos,
  onTaskSelect,
}: RecentReposQuickAccessProps) {
  const posthog = usePostHog();
  const setSelectedRepo = useSetAtom(selectedRepoAtom);
  const setSelectedBranch = useSetAtom(selectedBranchAtom);

  const handleRepoClick = (repo: UserRepo) => {
    // Set selected repo and branch
    setSelectedRepo(repo.full_name);
    setSelectedBranch(repo.default_branch);

    // Populate prompt with suggested task
    const suggestedPrompt =
      "Review this repository and suggest improvements to code quality, test coverage, or documentation";
    onTaskSelect(suggestedPrompt);

    // Track event
    posthog?.capture("quick_start_repo_selected", {
      repoFullName: repo.full_name,
      language: repo.language,
      stars: repo.stargazers_count,
    });
  };

  if (repos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground/70">
        Recent Repositories
      </h3>
      <div className="flex gap-2 overflow-x-auto lg:grid lg:grid-cols-5 scrollbar-hide pb-2">
        {repos.slice(0, 5).map((repo) => (
          <RepoQuickAccessCard
            key={repo.full_name}
            repo={repo}
            onClick={() => handleRepoClick(repo)}
          />
        ))}
      </div>
    </div>
  );
}
