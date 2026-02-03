"use client";

import { useState } from "react";
import { Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CredentialFieldDefinition } from "@/lib/mcp-registry";

interface CredentialFieldInputProps {
  field: CredentialFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CredentialFieldInput({
  field,
  value,
  onChange,
  disabled,
}: CredentialFieldInputProps) {
  const [showValue, setShowValue] = useState(false);
  const isPasswordType = field.type === "password";

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.name} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={field.name}
          type={isPasswordType && !showValue ? "password" : "text"}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={isPasswordType ? "pr-10" : undefined}
        />
        {isPasswordType && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={() => setShowValue(!showValue)}
            tabIndex={-1}
          >
            {showValue ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>
      {(field.description || field.helpUrl) && (
        <p className="text-xs text-muted-foreground">
          {field.description}
          {field.helpUrl && (
            <>
              {field.description && " "}
              <a
                href={field.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                {field.helpText || "Get one here"}
                <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
