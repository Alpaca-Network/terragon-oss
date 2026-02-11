"use client";

import { Plus } from "lucide-react";
import type { SkillsConfig } from "@terragon/sandbox/skills-config";
import { SkillCard } from "./SkillCard";

interface SkillListProps {
  config: SkillsConfig;
  onEdit: (skillKey: string) => void;
  onRemove: (skillKey: string) => void;
  onAdd: () => void;
  disabled?: boolean;
}

export function SkillList({
  config,
  onEdit,
  onRemove,
  onAdd,
  disabled,
}: SkillListProps) {
  const skills = Object.entries(config.skills);
  const isEmpty = skills.length === 0;

  if (isEmpty) {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="w-full rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-full bg-muted p-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Add your first skill</p>
            <p className="text-xs text-muted-foreground">
              Create custom instructions and workflows for your agent
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {skills.map(([skillKey, skill]) => (
        <SkillCard
          key={skillKey}
          skillKey={skillKey}
          skill={skill}
          onEdit={() => onEdit(skillKey)}
          onRemove={() => onRemove(skillKey)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
