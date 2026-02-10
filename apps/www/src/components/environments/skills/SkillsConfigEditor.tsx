"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, Code, LayoutGrid, Plus } from "lucide-react";
import type { SkillsConfig, UserSkill } from "@terragon/sandbox/skills-config";
import { validateSkillsConfig } from "@terragon/sandbox/skills-config";
import { SkillList } from "./SkillList";
import { AddEditSkillDialog } from "./AddEditSkillDialog";
import { SkillsJsonEditor } from "./SkillsJsonEditor";

interface SkillsConfigEditorProps {
  value: SkillsConfig;
  onChange: (config: SkillsConfig) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  disabled?: boolean;
}

type EditorMode = "visual" | "json";

export function SkillsConfigEditor({
  value,
  onChange,
  onDirtyChange,
  disabled,
}: SkillsConfigEditorProps) {
  const [mode, setMode] = useState<EditorMode>("visual");
  const [localConfig, setLocalConfig] = useState<SkillsConfig>(value);
  const [isDirty, setIsDirty] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<{
    skillKey: string;
    skill: UserSkill;
  } | null>(null);

  // Sync local config with prop value when it changes externally
  useEffect(() => {
    if (!isDirty) {
      setLocalConfig(value);
    }
  }, [value, isDirty]);

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const skillKeys = useMemo(
    () => Object.keys(localConfig.skills),
    [localConfig.skills],
  );

  const markDirty = useCallback(() => {
    if (!isDirty) {
      setIsDirty(true);
    }
  }, [isDirty]);

  const handleAddSkill = useCallback(
    (skill: UserSkill) => {
      setLocalConfig((prev) => ({
        skills: {
          ...prev.skills,
          [skill.name]: skill,
        },
      }));
      markDirty();
    },
    [markDirty],
  );

  const handleRemoveSkill = useCallback(
    (skillKey: string) => {
      setLocalConfig((prev) => {
        const { [skillKey]: removed, ...rest } = prev.skills;
        return { skills: rest };
      });
      markDirty();
    },
    [markDirty],
  );

  const handleEditSkill = useCallback(
    (skillKey: string) => {
      const skill = localConfig.skills[skillKey];
      if (!skill) return;

      setEditingSkill({
        skillKey,
        skill,
      });
    },
    [localConfig.skills],
  );

  const handleUpdateSkill = useCallback(
    (skill: UserSkill) => {
      setLocalConfig((prev) => {
        // Handle rename: if the key changed, remove old key
        const oldKey = editingSkill?.skillKey;
        if (oldKey && oldKey !== skill.name) {
          const { [oldKey]: removed, ...rest } = prev.skills;
          return {
            skills: {
              ...rest,
              [skill.name]: skill,
            },
          };
        }
        return {
          skills: {
            ...prev.skills,
            [skill.name]: skill,
          },
        };
      });
      setEditingSkill(null);
      markDirty();
    },
    [editingSkill?.skillKey, markDirty],
  );

  const handleSave = useCallback(() => {
    // Validate before saving
    const validationResult = validateSkillsConfig(localConfig);
    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }

    onChange(localConfig);
    setIsDirty(false);
    toast.success("Skills configuration saved");
  }, [localConfig, onChange]);

  const handleReset = useCallback(() => {
    setLocalConfig(value);
    setIsDirty(false);
  }, [value]);

  const handleJsonChange = useCallback(
    (config: SkillsConfig) => {
      setLocalConfig(config);
      onChange(config);
      setIsDirty(false);
    },
    [onChange],
  );

  // For JSON mode, track dirty state separately
  const handleJsonDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant={mode === "visual" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-2.5"
            onClick={() => setMode("visual")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Visual
          </Button>
          <Button
            variant={mode === "json" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-2.5"
            onClick={() => setMode("json")}
          >
            <Code className="h-3.5 w-3.5" />
            JSON
          </Button>
        </div>

        {mode === "visual" && skillKeys.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => setAddDialogOpen(true)}
            disabled={disabled}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Skill
          </Button>
        )}
      </div>

      {/* Visual Editor */}
      {mode === "visual" && (
        <>
          <SkillList
            config={localConfig}
            onEdit={handleEditSkill}
            onRemove={handleRemoveSkill}
            onAdd={() => setAddDialogOpen(true)}
            disabled={disabled}
          />

          {/* Save/Reset Buttons */}
          {isDirty && (
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={disabled}
              >
                <Check className="h-3 w-3 mr-1" />
                Save Skills Config
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={disabled}
              >
                Reset
              </Button>
            </div>
          )}
        </>
      )}

      {/* JSON Editor */}
      {mode === "json" && (
        <SkillsJsonEditor
          value={localConfig}
          onChange={handleJsonChange}
          onDirtyChange={handleJsonDirtyChange}
          disabled={disabled}
        />
      )}

      {/* Add Dialog */}
      <AddEditSkillDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        existingSkillKeys={skillKeys}
        onSave={handleAddSkill}
      />

      {/* Edit Dialog */}
      {editingSkill && (
        <AddEditSkillDialog
          open={!!editingSkill}
          onOpenChange={(open) => !open && setEditingSkill(null)}
          existingSkillKeys={skillKeys.filter(
            (k) => k !== editingSkill.skillKey,
          )}
          onSave={handleUpdateSkill}
          editMode={{
            skillKey: editingSkill.skillKey,
            existingSkill: editingSkill.skill,
          }}
        />
      )}
    </div>
  );
}
