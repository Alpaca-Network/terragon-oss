"use client";

import { useState, useDeferredValue } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  Terminal,
  Globe,
  Radio,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMcpRegistrySearch } from "@/queries/mcp-registry-queries";
import type { RegistrySearchResult, McpServerType } from "@/lib/mcp-registry";

interface SearchRegistryTabProps {
  onSelectServer: (server: RegistrySearchResult) => void;
  existingServerKeys: string[];
}

function ServerTypeIcon({ type }: { type: McpServerType }) {
  switch (type) {
    case "command":
      return <Terminal className="h-3 w-3" />;
    case "http":
      return <Globe className="h-3 w-3" />;
    case "sse":
      return <Radio className="h-3 w-3" />;
  }
}

function SourceBadge({ source }: { source: "official" | "smithery" }) {
  return (
    <Badge
      variant={source === "official" ? "default" : "secondary"}
      className="text-[10px] px-1.5 py-0"
    >
      {source === "official" ? "Official" : "Smithery"}
    </Badge>
  );
}

function SearchResultCard({
  result,
  onSelect,
  isAdded,
}: {
  result: RegistrySearchResult;
  onSelect: () => void;
  isAdded: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isAdded}
      className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed w-full"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <ServerTypeIcon type={result.serverType} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{result.displayName}</span>
          <SourceBadge source={result.source} />
          {result.verified && (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          )}
          {isAdded && (
            <Badge variant="outline" className="text-xs">
              Added
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {result.description}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{result.qualifiedName}</span>
          {result.homepage && (
            <a
              href={result.homepage}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </button>
  );
}

export function SearchRegistryTab({
  onSelectServer,
  existingServerKeys,
}: SearchRegistryTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);

  const { data, isLoading, isError, error } = useMcpRegistrySearch(
    deferredQuery,
    deferredQuery.length >= 2,
  );

  const results = data?.results || [];
  const errors = data?.errors || [];
  const hasQuery = deferredQuery.length >= 2;
  const showResults = hasQuery && !isLoading;

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search MCP servers (e.g., github, postgres, notion)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Registry Errors (partial failures) */}
      {errors.length > 0 && showResults && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{errors.join(", ")}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && hasQuery && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-sm text-muted-foreground">
            Failed to search registries
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {/* Empty State - No Query */}
      {!hasQuery && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Search for MCP servers across registries
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Enter at least 2 characters to search
          </p>
        </div>
      )}

      {/* Empty State - No Results */}
      {showResults && results.length === 0 && !isError && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            No servers found for "{deferredQuery}"
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Try a different search term or check the Recommended tab
          </p>
        </div>
      )}

      {/* Results */}
      {showResults && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {results.length} server{results.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid gap-2">
            {results.map((result) => (
              <SearchResultCard
                key={result.id}
                result={result}
                onSelect={() => onSelectServer(result)}
                isAdded={existingServerKeys.some(
                  (key) =>
                    key === result.name ||
                    key === result.qualifiedName.replace("/", "-"),
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
