"use client";

import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserSkill } from "@terragon/sandbox/skills-config";

interface AddEditSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSkillKeys: string[];
  onSave: (skill: UserSkill) => void;
  editMode?: {
    skillKey: string;
    existingSkill: UserSkill;
  };
}

// Reserved skill names that cannot be used
const RESERVED_SKILL_NAMES = [
  "init",
  "pr-comments",
  "review",
  "clear",
  "compact",
  "help",
  "bug",
  "config",
  "cost",
  "doctor",
  "login",
  "logout",
  "mcp",
  "memory",
  "model",
  "permissions",
  "resume",
  "terminal-setup",
  "vim",
];

export function AddEditSkillDialog({
  open,
  onOpenChange,
  existingSkillKeys,
  onSave,
  editMode,
}: AddEditSkillDialogProps) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [argumentHint, setArgumentHint] = useState("");
  const [content, setContent] = useState("");
  const [userInvocable, setUserInvocable] = useState(true);
  const [disableModelInvocation, setDisableModelInvocation] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editMode) {
        setName(editMode.existingSkill.name);
        setDisplayName(editMode.existingSkill.displayName || "");
        setDescription(editMode.existingSkill.description);
        setArgumentHint(editMode.existingSkill.argumentHint || "");
        setContent(editMode.existingSkill.content);
        setUserInvocable(editMode.existingSkill.userInvocable);
        setDisableModelInvocation(
          editMode.existingSkill.disableModelInvocation,
        );
      } else {
        setName("");
        setDisplayName("");
        setDescription("");
        setArgumentHint("");
        setContent("");
        setUserInvocable(true);
        setDisableModelInvocation(false);
      }
      setErrors({});
    }
  }, [open, editMode]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      newErrors.name =
        "Name must contain only letters, numbers, dashes, and underscores";
    } else if (RESERVED_SKILL_NAMES.includes(name.toLowerCase())) {
      newErrors.name = `"${name}" is a reserved name`;
    } else if (
      existingSkillKeys.includes(name) &&
      (!editMode || editMode.skillKey !== name)
    ) {
      newErrors.name = "A skill with this name already exists";
    }

    // Validate description
    if (!description.trim()) {
      newErrors.description = "Description is required";
    }

    // Validate content
    if (!content.trim()) {
      newErrors.content = "Content is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }

    const skill: UserSkill = {
      name: name.trim(),
      displayName: displayName.trim() || undefined,
      description: description.trim(),
      argumentHint: argumentHint.trim() || undefined,
      content: content.trim(),
      userInvocable,
      disableModelInvocation,
    };

    onSave(skill);
    onOpenChange(false);
  };

  const isEditing = !!editMode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <Zap className="h-4 w-4 text-muted-foreground" />
            </div>
            {isEditing ? "Edit Skill" : "Create Skill"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modify your custom skill configuration."
              : "Create a new custom skill with instructions for the agent."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Skill Name */}
          <div className="space-y-2">
            <Label htmlFor="skill-name">
              Skill Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="skill-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                setErrors((prev) => ({ ...prev, name: "" }));
              }}
              placeholder="my-custom-skill"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Used to invoke the skill with /{name || "skill-name"}
            </p>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My Custom Skill"
            />
            <p className="text-xs text-muted-foreground">
              Optional friendly name shown in the UI
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors((prev) => ({ ...prev, description: "" }));
              }}
              placeholder="Briefly describe what this skill does"
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Argument Hint */}
          <div className="space-y-2">
            <Label htmlFor="argument-hint">Argument Hint</Label>
            <Input
              id="argument-hint"
              value={argumentHint}
              onChange={(e) => setArgumentHint(e.target.value)}
              placeholder="[filename] [options]"
            />
            <p className="text-xs text-muted-foreground">
              Hint shown for expected arguments (e.g., [filename])
            </p>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">
              Skill Content <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setErrors((prev) => ({ ...prev, content: "" }));
              }}
              placeholder={`# Skill Instructions

Analyze the code at $ARGUMENTS and explain it clearly.

Use visual diagrams where helpful.`}
              className={`min-h-[200px] font-mono text-sm ${
                errors.content ? "border-destructive" : ""
              }`}
            />
            {errors.content && (
              <p className="text-xs text-destructive">{errors.content}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">$ARGUMENTS</code> for
              user input,{" "}
              <code className="bg-muted px-1 rounded">$0, $1, $2</code> for
              positional args
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="user-invocable">User Invocable</Label>
                <p className="text-xs text-muted-foreground">
                  Allow users to invoke this skill with /{name || "skill-name"}
                </p>
              </div>
              <Switch
                id="user-invocable"
                checked={userInvocable}
                onCheckedChange={setUserInvocable}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="disable-model">Disable Model Invocation</Label>
                <p className="text-xs text-muted-foreground">
                  Prevent the agent from invoking this skill automatically
                </p>
              </div>
              <Switch
                id="disable-model"
                checked={disableModelInvocation}
                onCheckedChange={setDisableModelInvocation}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEditing ? "Save Changes" : "Create Skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
