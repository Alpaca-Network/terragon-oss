"use client";

import { useState, useCallback, useEffect } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  SkillsConfig,
  validateSkillsConfig,
} from "@terragon/sandbox/skills-config";

interface SkillsJsonEditorProps {
  value: SkillsConfig;
  onChange: (config: SkillsConfig) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  disabled?: boolean;
}

export function SkillsJsonEditor({
  value,
  onChange,
  onDirtyChange,
  disabled,
}: SkillsJsonEditorProps) {
  const [configText, setConfigText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    // Initialize the text with the current value
    if (value && Object.keys(value.skills).length > 0) {
      setConfigText(JSON.stringify(value, null, 2));
    }
  }, [value]);

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setConfigText(newText);
      setIsDirty(true);
      setError(null);

      // Try to parse and validate the JSON
      if (newText.trim()) {
        try {
          const parsed = JSON.parse(newText);
          const validationResult = validateSkillsConfig(parsed);
          if (!validationResult.success) {
            setError(validationResult.error);
          }
        } catch (_error) {
          setError("Invalid JSON format");
        }
      }
    },
    [],
  );

  const handleSave = useCallback(() => {
    if (!configText.trim()) {
      // Empty config means no custom skills
      onChange({ skills: {} });
      setIsDirty(false);
      return;
    }

    try {
      const parsed = JSON.parse(configText);
      const validationResult = validateSkillsConfig(parsed);

      if (!validationResult.success) {
        setError(validationResult.error);
        return;
      }

      onChange(validationResult.data);
      setIsDirty(false);
      setError(null);
    } catch (_error) {
      setError("Invalid JSON format");
    }
  }, [configText, onChange]);

  const handleReset = useCallback(() => {
    if (value && Object.keys(value.skills).length > 0) {
      setConfigText(JSON.stringify(value, null, 2));
    } else {
      setConfigText("");
    }
    setError(null);
    setIsDirty(false);
  }, [value]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Textarea
          value={configText}
          onChange={handleTextChange}
          placeholder={`Enter your skills config JSON here...

Example:
{
  "skills": {
    "explain-code": {
      "name": "explain-code",
      "description": "Explains code with visual diagrams",
      "content": "Analyze the code at $ARGUMENTS and explain it clearly.",
      "argumentHint": "[filename]",
      "userInvocable": true,
      "disableModelInvocation": false
    }
  }
}`}
          className={cn(
            "font-mono text-xs min-h-[200px]",
            error && "border-destructive",
          )}
          disabled={disabled}
        />
        {error && (
          <div className="absolute -bottom-5 left-0 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={disabled || !isDirty || !!error}
        >
          <Check className="h-3 w-3 mr-1" />
          Save Skills Config
        </Button>
        {isDirty && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={disabled}
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
