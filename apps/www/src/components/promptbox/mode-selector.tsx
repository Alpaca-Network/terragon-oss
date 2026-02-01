"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { memo } from "react";
import {
  NotebookPen,
  FileCode,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type PermissionMode = "allowAll" | "plan" | "loop";

export type LoopConfigInput = {
  maxIterations: number;
  completionPromise: string;
  useRegex: boolean;
  requireApproval: boolean;
};

interface ModeSelectorProps {
  mode: PermissionMode;
  onChange: (mode: PermissionMode) => void;
  loopConfig?: LoopConfigInput;
  onLoopConfigChange?: (config: LoopConfigInput) => void;
  className?: string;
}

const modeConfig = {
  allowAll: {
    icon: FileCode,
    label: "Execute",
    description: "Implement immediately",
  },
  plan: {
    icon: NotebookPen,
    label: "Plan",
    description: "Approve before making changes",
  },
  loop: {
    icon: RefreshCw,
    label: "Loop",
    description: "Iterate until completion",
  },
} as const;

const defaultLoopConfig: LoopConfigInput = {
  maxIterations: 3,
  completionPromise: "DONE",
  useRegex: false,
  requireApproval: false,
};

function LoopConfigPanel({
  config,
  onChange,
  className,
}: {
  config: LoopConfigInput;
  onChange: (config: LoopConfigInput) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3 p-3 bg-muted/50 rounded-md", className)}>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label
            htmlFor="maxIterations"
            className="text-xs text-muted-foreground"
          >
            Max Iterations
          </Label>
          <div className="flex items-center gap-1 mt-1">
            <Input
              id="maxIterations"
              type="number"
              min={1}
              max={10}
              value={config.maxIterations}
              onChange={(e) =>
                onChange({
                  ...config,
                  maxIterations: Math.max(
                    1,
                    Math.min(10, parseInt(e.target.value) || 3),
                  ),
                })
              }
              className="h-7 text-xs flex-1"
            />
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...config,
                    maxIterations: Math.min(10, config.maxIterations + 1),
                  })
                }
                disabled={config.maxIterations >= 10}
                className="h-3.5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Increase iterations"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...config,
                    maxIterations: Math.max(1, config.maxIterations - 1),
                  })
                }
                disabled={config.maxIterations <= 1}
                className="h-3.5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Decrease iterations"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <Label
            htmlFor="completionPromise"
            className="text-xs text-muted-foreground"
          >
            Completion Signal
          </Label>
          <Input
            id="completionPromise"
            type="text"
            value={config.completionPromise}
            onChange={(e) =>
              onChange({
                ...config,
                completionPromise: e.target.value || "DONE",
              })
            }
            placeholder="e.g., DONE"
            className="h-7 text-xs mt-1"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="useRegex"
            checked={config.useRegex}
            onCheckedChange={(checked) =>
              onChange({ ...config, useRegex: checked })
            }
            className="scale-75"
          />
          <Label
            htmlFor="useRegex"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Use Regex
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="requireApproval"
            checked={config.requireApproval}
            onCheckedChange={(checked) =>
              onChange({ ...config, requireApproval: checked })
            }
            className="scale-75"
          />
          <Label
            htmlFor="requireApproval"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Approval Mode
          </Label>
        </div>
      </div>
    </div>
  );
}

function ModeSelectorInner({
  mode,
  onChange,
  loopConfig = defaultLoopConfig,
  onLoopConfigChange,
  className,
}: ModeSelectorProps) {
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [showLoopConfig, setShowLoopConfig] = React.useState(mode === "loop");
  const currentConfig = modeConfig[mode];
  const Icon = currentConfig.icon;

  const handleLoopConfigChange = (config: LoopConfigInput) => {
    onLoopConfigChange?.(config);
  };

  const triggerClassName = cn(
    "w-fit px-1",
    "border-none shadow-none hover:bg-transparent text-muted-foreground/70 hover:text-foreground gap-0.5 dark:bg-transparent dark:hover:bg-transparent",
    className,
  );

  return (
    <>
      <Drawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        dismissible
        modal
      >
        <DrawerTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(triggerClassName, "flex sm:hidden")}
            aria-expanded={isDrawerOpen}
            aria-haspopup="dialog"
          >
            <span className="flex items-center gap-1">
              <Icon className="h-2.5 w-2.5 text-inherit" />
            </span>
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle>Select Mode</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-1">
            {(
              Object.entries(modeConfig) as [
                PermissionMode,
                (typeof modeConfig)[PermissionMode],
              ][]
            ).map(([modeKey, config]) => {
              const isSelected = mode === modeKey;
              const ModeIcon = config.icon;
              return (
                <div key={modeKey}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(modeKey);
                      if (modeKey !== "loop") {
                        setIsDrawerOpen(false);
                      }
                    }}
                    className={cn(
                      "flex w-full gap-2 items-start justify-start rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors",
                      isSelected && "bg-muted",
                      !isSelected && "hover:bg-muted/60",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 mt-0.5",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-foreground/90 flex items-center gap-1">
                        <ModeIcon className="h-2.5 w-2.5 text-inherit" />
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground/60">
                        {config.description}
                      </span>
                    </div>
                  </button>
                  {modeKey === "loop" && isSelected && (
                    <LoopConfigPanel
                      config={loopConfig}
                      onChange={handleLoopConfigChange}
                      className="mx-3 mt-2"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
      <div className="hidden sm:flex flex-col">
        <div className="flex items-center gap-1">
          <Select
            value={mode}
            onValueChange={(value) => {
              onChange(value as PermissionMode);
              if (value === "loop") {
                setShowLoopConfig(true);
              }
            }}
          >
            <SelectTrigger className={triggerClassName} size="sm">
              <SelectValue asChild>
                <span className="flex items-center gap-1">
                  <Icon className="h-2.5 w-2.5 text-inherit" />
                  <span className="hidden sm:inline">
                    {currentConfig.label}
                  </span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="w-fit">
              <SelectItem value="allowAll">
                <span className="flex flex-col items-start">
                  <span className="text-sm text-foreground/90 flex items-center gap-1">
                    <FileCode className="h-2.5 w-2.5 text-inherit" />
                    Execute
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    Implement immediately
                  </span>
                </span>
              </SelectItem>
              <SelectItem value="plan">
                <span className="flex flex-col items-start">
                  <span className="text-sm text-foreground/90 flex items-center gap-1">
                    <NotebookPen className="h-2.5 w-2.5 text-inherit" />
                    Plan
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    Approve before making changes
                  </span>
                </span>
              </SelectItem>
              <SelectItem value="loop">
                <span className="flex flex-col items-start">
                  <span className="text-sm text-foreground/90 flex items-center gap-1">
                    <RefreshCw className="h-2.5 w-2.5 text-inherit" />
                    Loop
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    Iterate until completion
                  </span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {mode === "loop" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground/70 hover:text-foreground"
              onClick={() => setShowLoopConfig(!showLoopConfig)}
            >
              {showLoopConfig ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
        {mode === "loop" && showLoopConfig && (
          <LoopConfigPanel
            config={loopConfig}
            onChange={handleLoopConfigChange}
            className="mt-2 w-64"
          />
        )}
      </div>
    </>
  );
}

export const ModeSelector = memo(ModeSelectorInner);
