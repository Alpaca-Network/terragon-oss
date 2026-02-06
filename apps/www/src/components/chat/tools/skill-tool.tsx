import React from "react";
import { AllToolParts } from "@terragon/shared";
import {
  GenericToolPart,
  GenericToolPartContentOneLine,
  GenericToolPartContentResultWithPreview,
} from "./generic-ui";
import { Sparkles } from "lucide-react";

type SkillToolPart = Extract<AllToolParts, { name: "Skill" }>;

export function SkillTool({ toolPart }: { toolPart: SkillToolPart }) {
  const skillName = toolPart.parameters?.skill || "unknown skill";

  // Extract skill description from result if available
  const getPreview = () => {
    if (toolPart.status === "pending") {
      return null;
    }
    if (toolPart.status === "error") {
      return `Failed to load skill "${skillName}"`;
    }
    // Try to extract description from result
    const result = toolPart.result || "";
    const descMatch = result.match(/^# Skill:.*?\n\n([^\n]+)/);
    if (descMatch) {
      return descMatch[1];
    }
    return `Loaded skill "${skillName}"`;
  };

  return (
    <GenericToolPart
      toolName="Skill"
      toolArg={skillName}
      toolStatus={toolPart.status}
      toolColor="purple"
    >
      {toolPart.status === "pending" ? (
        <GenericToolPartContentOneLine toolStatus="pending">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 animate-pulse" />
            Loading skill...
          </span>
        </GenericToolPartContentOneLine>
      ) : toolPart.status === "error" ? (
        <GenericToolPartContentResultWithPreview
          preview={getPreview() || "Error"}
          content={toolPart.result}
          toolStatus="error"
        />
      ) : (
        <GenericToolPartContentResultWithPreview
          preview={getPreview() || "Done"}
          content={toolPart.result}
          toolStatus="completed"
        />
      )}
    </GenericToolPart>
  );
}
