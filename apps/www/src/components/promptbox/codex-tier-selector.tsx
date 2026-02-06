"use client";

import React, { memo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Zap, Gauge, Brain, Flame, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Check } from "lucide-react";
import type { CodexTier } from "@terragon/shared/db/types";

interface CodexTierSelectorProps {
  tier: CodexTier;
  onChange: (tier: CodexTier) => void;
  className?: string;
  disabled?: boolean;
}

export const tierConfig = {
  none: {
    icon: ZapOff,
    label: "None",
    shortLabel: "None",
    description: "No reasoning, fastest responses",
  },
  low: {
    icon: Zap,
    label: "Low",
    shortLabel: "Low",
    description: "Minimal reasoning, quick responses",
  },
  medium: {
    icon: Gauge,
    label: "Medium",
    shortLabel: "Med",
    description: "Balanced speed and quality",
  },
  high: {
    icon: Brain,
    label: "High",
    shortLabel: "High",
    description: "Thorough reasoning",
  },
  xhigh: {
    icon: Flame,
    label: "Max",
    shortLabel: "Max",
    description: "Extended thinking for best results",
  },
} as const;

function CodexTierSelectorInner({
  tier,
  onChange,
  className,
  disabled,
}: CodexTierSelectorProps) {
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const currentConfig = tierConfig[tier];
  const Icon = currentConfig.icon;

  const triggerClassName = cn(
    "w-fit px-1",
    "border-none shadow-none hover:bg-transparent text-muted-foreground/70 hover:text-foreground gap-0.5 dark:bg-transparent dark:hover:bg-transparent",
    className,
  );

  return (
    <>
      {/* Mobile Drawer */}
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
            disabled={disabled}
          >
            <span className="flex items-center gap-1">
              <Icon className="h-2.5 w-2.5 text-inherit" />
            </span>
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle>Reasoning Effort</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-1">
            {(
              Object.entries(tierConfig) as [
                CodexTier,
                (typeof tierConfig)[CodexTier],
              ][]
            ).map(([tierKey, config]) => {
              const isSelected = tier === tierKey;
              const TierIcon = config.icon;
              return (
                <button
                  key={tierKey}
                  type="button"
                  onClick={() => {
                    onChange(tierKey);
                    setIsDrawerOpen(false);
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
                      <TierIcon className="h-2.5 w-2.5 text-inherit" />
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {config.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Desktop Select */}
      <div className="hidden sm:flex flex-col">
        <Select
          value={tier}
          onValueChange={(value) => onChange(value as CodexTier)}
          disabled={disabled}
        >
          <SelectTrigger className={triggerClassName} size="sm">
            <SelectValue asChild>
              <span className="flex items-center gap-1">
                <Icon className="h-2.5 w-2.5 text-inherit" />
                <span className="hidden sm:inline">
                  {currentConfig.shortLabel}
                </span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="w-fit">
            {(
              Object.entries(tierConfig) as [
                CodexTier,
                (typeof tierConfig)[CodexTier],
              ][]
            ).map(([tierKey, config]) => {
              const TierIcon = config.icon;
              return (
                <SelectItem key={tierKey} value={tierKey}>
                  <span className="flex flex-col items-start">
                    <span className="text-sm text-foreground/90 flex items-center gap-1">
                      <TierIcon className="h-2.5 w-2.5 text-inherit" />
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {config.description}
                    </span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

export const CodexTierSelector = memo(CodexTierSelectorInner);
