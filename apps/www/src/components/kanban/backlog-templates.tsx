"use client";

import { memo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BacklogTemplate,
  BUILT_IN_TEMPLATES,
  getAllTemplates,
} from "@/lib/backlog-templates";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BacklogTemplatePickerProps {
  onTemplateSelect: (template: BacklogTemplate | null) => void;
  selectedTemplateId?: string | null;
  customTemplates?: BacklogTemplate[];
  onCreateTemplate?: (template: BacklogTemplate) => void;
  className?: string;
}

function BacklogTemplatePickerInner({
  onTemplateSelect,
  selectedTemplateId,
  customTemplates = [],
  onCreateTemplate,
  className,
}: BacklogTemplatePickerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [newTemplatePrompt, setNewTemplatePrompt] = useState("");

  const allTemplates = getAllTemplates(customTemplates);
  const builtInTemplates = BUILT_IN_TEMPLATES;
  const userTemplates = customTemplates;

  const handleValueChange = (value: string) => {
    if (value === "none") {
      onTemplateSelect(null);
    } else if (value === "create-new") {
      setIsCreateDialogOpen(true);
    } else {
      const template = allTemplates.find((t) => t.id === value);
      if (template) {
        onTemplateSelect(template);
      }
    }
  };

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim() || !newTemplatePrompt.trim()) return;

    const newTemplate: BacklogTemplate = {
      id: `custom-${Date.now()}`,
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim(),
      prompt: newTemplatePrompt.trim(),
      isBuiltIn: false,
    };

    onCreateTemplate?.(newTemplate);
    onTemplateSelect(newTemplate);
    setIsCreateDialogOpen(false);
    setNewTemplateName("");
    setNewTemplateDescription("");
    setNewTemplatePrompt("");
  };

  return (
    <>
      <Select
        value={selectedTemplateId ?? "none"}
        onValueChange={handleValueChange}
      >
        <SelectTrigger className={className} size="sm">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Use template..." />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">No template</span>
          </SelectItem>

          {builtInTemplates.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Built-in Templates
              </div>
              {builtInTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex flex-col items-start">
                    <span className="text-sm">{template.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {template.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </>
          )}

          {userTemplates.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Your Templates
              </div>
              {userTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex flex-col items-start">
                    <span className="text-sm">{template.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {template.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </>
          )}

          {onCreateTemplate && (
            <>
              <div className="my-1 border-t" />
              <SelectItem value="create-new">
                <div className="flex items-center gap-1.5 text-primary">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create custom template</span>
                </div>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Custom Template</DialogTitle>
            <DialogDescription>
              Create a reusable template for your backlog items
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., API Integration"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">
                Description (optional)
              </Label>
              <Input
                id="template-description"
                placeholder="Brief description of the template"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-prompt">Template Content</Label>
              <Textarea
                id="template-prompt"
                placeholder="Enter the template content..."
                className="min-h-[200px] font-mono text-sm"
                value={newTemplatePrompt}
                onChange={(e) => setNewTemplatePrompt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={!newTemplateName.trim() || !newTemplatePrompt.trim()}
            >
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const BacklogTemplatePicker = memo(BacklogTemplatePickerInner);
