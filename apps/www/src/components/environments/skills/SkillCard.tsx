"use client";

import { Pencil, Trash2, Zap, EyeOff, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UserSkill } from "@terragon/sandbox/skills-config";

interface SkillCardProps {
  skillKey: string;
  skill: UserSkill;
  onEdit: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function SkillCard({
  skillKey,
  skill,
  onEdit,
  onRemove,
  disabled,
}: SkillCardProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm truncate">
            {skill.displayName || skillKey}
          </span>
          {!skill.userInvocable && (
            <Badge variant="secondary" className="text-xs gap-1 font-normal">
              <EyeOff className="h-3 w-3" />
              Model Only
            </Badge>
          )}
          {skill.disableModelInvocation && (
            <Badge variant="secondary" className="text-xs gap-1 font-normal">
              <User className="h-3 w-3" />
              User Only
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {skill.description}
        </p>
        {skill.argumentHint && (
          <p className="text-xs text-muted-foreground/70 font-mono truncate">
            /{skillKey} {skill.argumentHint}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onEdit}
          disabled={disabled}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">Edit {skillKey}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onRemove}
          disabled={disabled}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Remove {skillKey}</span>
        </Button>
      </div>
    </div>
  );
}
