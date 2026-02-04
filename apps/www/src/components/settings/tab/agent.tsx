"use client";

import { useAtomValue, useSetAtom } from "jotai";
import {
  userAtom,
  allAgentsAtom,
  userSettingsAtom,
  useUpdateUserSettingsMutation,
} from "@/atoms/user";
import { CredentialsList } from "@/components/credentials/credentials-list";
import {
  AddClaudeCredentialDialog,
  AddCodexCredentialDialog,
  AddAmpCredentialDialog,
  AddGeminiCredentialDialog,
} from "@/components/credentials/add-credential-dialog";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SettingsSection, SettingsWithCTA } from "../settings-row";
import { AIAgent, AIModel, CodeRouterMode } from "@terragon/agent/types";
import { Plus, Info, ExternalLink, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { userCredentialsRefetchAtom } from "@/atoms/user-credentials";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getModelInfo,
  getAgentInfo,
  getAgentDisplayName,
  isAgentEnabledByDefault,
  agentToModels,
  getModelDisplayName,
  isModelEnabledByDefault,
  isConnectedCredentialsSupported,
  getDefaultCodeRouterSettings,
} from "@terragon/agent/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { userCredentialsAtom } from "@/atoms/user-credentials";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { AgentIcon } from "@/components/chat/agent-icon";
import { cn } from "@/lib/utils";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AgentSettings() {
  const user = useAtomValue(userAtom);
  const userSettings = useAtomValue(userSettingsAtom);
  const codeRouterEnabled = useFeatureFlag("gatewayzCodeRouter");

  if (!user || !userSettings) {
    return null;
  }
  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        label="Agent Configuration"
        description="Customize how the coding agent behaves across all your tasks"
      >
        <CustomSystemPromptSetting />
      </SettingsSection>
      {codeRouterEnabled && <CodeRouterSettingsSection />}
      <AgentAndModelsEnabledSection />
      <AgentProvidersSection />
    </div>
  );
}

function AgentProvidersSection() {
  const allAgents = useAtomValue(allAgentsAtom);
  const agents = allAgents.filter((agent) => {
    return isConnectedCredentialsSupported(agent);
  });
  const [selectProviderOpen, setSelectProviderOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);

  const handleAgentSelect = (agent: AIAgent) => {
    setSelectedAgent(agent);
    setSelectProviderOpen(false);
    setCredentialDialogOpen(true);
  };

  const addCredentialCTA = (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setSelectProviderOpen(true)}
    >
      <Plus className="h-4 w-4" />
      Add Credential
    </Button>
  );

  return (
    <div id="agent-providers">
      <SettingsSection
        label="Agent Providers"
        description="Connect your existing subscriptions to power your coding agents"
        cta={addCredentialCTA}
      >
        <CredentialsList />
      </SettingsSection>
      <SelectProviderDialog
        open={selectProviderOpen}
        onOpenChange={setSelectProviderOpen}
        agents={agents}
        onSelect={handleAgentSelect}
      />
      {selectedAgent === "claudeCode" && (
        <AddClaudeCredentialDialog
          open={credentialDialogOpen}
          onOpenChange={(open) => {
            setCredentialDialogOpen(open);
            if (!open) {
              setSelectedAgent(null);
            }
          }}
        />
      )}
      {selectedAgent === "codex" && (
        <AddCodexCredentialDialog
          open={credentialDialogOpen}
          onOpenChange={(open) => {
            setCredentialDialogOpen(open);
            if (!open) {
              setSelectedAgent(null);
            }
          }}
        />
      )}
      {selectedAgent === "amp" && (
        <AddAmpCredentialDialog
          open={credentialDialogOpen}
          onOpenChange={(open) => {
            setCredentialDialogOpen(open);
            if (!open) {
              setSelectedAgent(null);
            }
          }}
        />
      )}
      {selectedAgent === "gemini" && (
        <AddGeminiCredentialDialog
          open={credentialDialogOpen}
          onOpenChange={(open) => {
            setCredentialDialogOpen(open);
            if (!open) {
              setSelectedAgent(null);
            }
          }}
        />
      )}
    </div>
  );
}

function SelectProviderDialog({
  open,
  onOpenChange,
  agents,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: AIAgent[];
  onSelect: (agent: AIAgent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Credential</DialogTitle>
          <DialogDescription>
            Choose which agent provider you'd like to add credentials for.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          {agents.map((agent) => (
            <Button
              key={agent}
              variant="outline"
              className="w-full justify-start flex items-center gap-2 px-4 h-fit"
              onClick={() => onSelect(agent)}
            >
              <AgentIcon agent={agent} sessionId={null} />
              <span>{getAgentDisplayName(agent)}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomSystemPromptSetting() {
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const userSettings = useAtomValue(userSettingsAtom);
  const userSettingsMutation = useUpdateUserSettingsMutation();
  const [customSystemPrompt, setCustomSystemPrompt] = useState(
    userSettings?.customSystemPrompt || "",
  );
  const handleChange = (newValue: string) => {
    setCustomSystemPrompt(newValue);
    setHasChanges(true);
  };
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setHasChanges(false);
      await userSettingsMutation.mutateAsync({ customSystemPrompt });
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <SettingsWithCTA label="Custom System Prompt" direction="col">
      <div className="flex flex-col gap-2 w-full">
        <Textarea
          value={customSystemPrompt}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Eg. Always use descriptive variable names..."
          className="min-h-48"
        />
        <Button
          disabled={!hasChanges || isSaving}
          onClick={handleSave}
          size="sm"
          className="self-start"
        >
          Save Changes
        </Button>
      </div>
    </SettingsWithCTA>
  );
}

function useAgentAndModelsEnabledSection() {
  const userSettings = useAtomValue(userSettingsAtom);
  const userSettingsMutation = useUpdateUserSettingsMutation();
  const agentPreferences = userSettings?.agentModelPreferences?.agents || {};
  const modelPreferences = userSettings?.agentModelPreferences?.models || {};
  const updateAgentPreference = async (agent: AIAgent, enabled: boolean) => {
    await userSettingsMutation.mutateAsync({
      agentModelPreferences: {
        ...userSettings?.agentModelPreferences,
        agents: {
          ...userSettings?.agentModelPreferences?.agents,
          [agent]: enabled,
        },
      },
    });
  };
  const updateModelPreference = async (model: AIModel, enabled: boolean) => {
    await userSettingsMutation.mutateAsync({
      agentModelPreferences: {
        ...userSettings?.agentModelPreferences,
        models: {
          ...userSettings?.agentModelPreferences?.models,
          [model]: enabled,
        },
      },
    });
  };

  return {
    agentPreferences,
    modelPreferences,
    updateAgentPreference,
    updateModelPreference,
  };
}

function AgentAndModelsEnabledSection() {
  const allAgents = useAtomValue(allAgentsAtom);
  const { agentPreferences, updateAgentPreference } =
    useAgentAndModelsEnabledSection();
  return (
    <div id="available-agents-and-models">
      <SettingsSection
        label="Available Agents & Models"
        description="Choose which agents and models are available when you create a new task"
      >
        <div className="space-y-4">
          {allAgents.map((agent) => {
            const isEnabled =
              agentPreferences[agent] ?? isAgentEnabledByDefault(agent);
            return (
              <AgentModelItem
                key={agent}
                agent={agent}
                isEnabled={isEnabled}
                onToggle={(enabled) => updateAgentPreference(agent, enabled)}
              />
            );
          })}
        </div>
      </SettingsSection>
    </div>
  );
}

function AgentModelItem({
  agent,
  isEnabled,
  onToggle,
}: {
  agent: AIAgent;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const userSettings = useAtomValue(userSettingsAtom);
  const openCodeOpenAIAnthropicModel = useFeatureFlag(
    "opencodeOpenAIAnthropicModelOption",
  );
  const openCodeGemini3ProModel = useFeatureFlag(
    "opencodeGemini3ProModelOption",
  );
  const models = agentToModels(agent, {
    agentVersion: "latest",
    enableOpenRouterOpenAIAnthropicModel: openCodeOpenAIAnthropicModel,
    enableOpencodeGemini3ProModelOption: openCodeGemini3ProModel,
    codeRouterSettings: userSettings?.codeRouterSettings ?? undefined,
  });
  const agentLabel = getAgentDisplayName(agent);
  const agentInfo = getAgentInfo(agent);

  return (
    <div
      className={cn("grid grid-cols-[auto_1fr_auto] gap-3", {
        "opacity-75": !isEnabled,
      })}
    >
      <div className="mt-0.5">
        <AgentIcon agent={agent} sessionId={null} />
      </div>
      <div>
        <p className="text-sm font-medium">{agentLabel}</p>
        {agentInfo && (
          <p className="text-xs text-muted-foreground mt-0.5">{agentInfo}</p>
        )}
        {models.length > 1 && (
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
            {models.map((model) => (
              <ModelItem key={model} model={model} agentEnabled={isEnabled} />
            ))}
          </div>
        )}
      </div>
      <Switch
        checked={isEnabled}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
    </div>
  );
}

function ModelItem({
  model,
  agentEnabled,
}: {
  model: AIModel;
  agentEnabled: boolean;
}) {
  const displayName = getModelDisplayName(model);
  const modelInfo = getModelInfo(model);
  const { modelPreferences, updateModelPreference } =
    useAgentAndModelsEnabledSection();
  const isEnabled =
    modelPreferences[model] ??
    isModelEnabledByDefault({ model, agentVersion: "latest" });
  return (
    <>
      <Checkbox
        id={`model-${model}`}
        checked={isEnabled}
        onCheckedChange={(checked) => updateModelPreference(model, !!checked)}
        disabled={!agentEnabled}
        className={cn("mt-0.5", {
          "opacity-75": !agentEnabled || !isEnabled,
        })}
      />
      <label
        htmlFor={`model-${model}`}
        className={cn(
          "cursor-pointer text-sm peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          {
            "opacity-75": !agentEnabled || !isEnabled,
          },
        )}
      >
        <span className="font-medium">{displayName.fullName}</span>
        {modelInfo && (
          <p className="text-xs text-muted-foreground mt-0.5">{modelInfo}</p>
        )}
      </label>
    </>
  );
}

function CodeRouterSettingsSection() {
  const userSettings = useAtomValue(userSettingsAtom);
  const userCredentials = useAtomValue(userCredentialsAtom);
  const userSettingsMutation = useUpdateUserSettingsMutation();
  const searchParams = useSearchParams();
  const refetchUserCredentials = useSetAtom(userCredentialsRefetchAtom);

  const codeRouterSettings =
    userSettings?.codeRouterSettings ?? getDefaultCodeRouterSettings();
  const hasGatewayz = userCredentials?.hasGatewayz ?? false;
  const gwTier = userCredentials?.gwTier ?? "free";

  // Handle successful Gatewayz connection callback
  useEffect(() => {
    if (searchParams.get("gatewayz_connected") === "true") {
      // Refetch credentials to update the UI
      refetchUserCredentials();
      toast.success("Gatewayz connected successfully!");
      // Clean up the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("gatewayz_connected");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, refetchUserCredentials]);

  const updateCodeRouterEnabled = async (enabled: boolean) => {
    await userSettingsMutation.mutateAsync({
      codeRouterSettings: {
        ...codeRouterSettings,
        enabled,
      },
    });
  };

  const updateCodeRouterMode = async (mode: CodeRouterMode) => {
    await userSettingsMutation.mutateAsync({
      codeRouterSettings: {
        ...codeRouterSettings,
        mode,
      },
    });
  };

  const handleConnectGatewayz = () => {
    // Redirect to initiate Gatewayz OAuth flow in "connect" mode
    const initiateUrl = new URL(
      "/api/auth/gatewayz/initiate",
      window.location.origin,
    );
    initiateUrl.searchParams.set("mode", "connect");
    initiateUrl.searchParams.set("returnUrl", "/settings/agent");
    window.location.href = initiateUrl.toString();
  };

  return (
    <div id="code-router-settings">
      <SettingsSection
        label={
          <span className="flex items-center gap-1.5">
            Gatewayz Optimizer
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                Improves code gen tasks while cutting the cost of inference by
                35% to 71%.
              </TooltipContent>
            </Tooltip>
          </span>
        }
        description="Enable intelligent model routing to automatically select the best model based on your optimization preference"
      >
        <div className="space-y-4">
          {/* Gatewayz Connection Status */}
          {hasGatewayz ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
              <Image
                src="/gatewayz-logo-icon.png"
                alt="Gatewayz"
                width={24}
                height={24}
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Gatewayz Connected
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground capitalize">
                  {gwTier} tier
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4">
              <div className="flex items-start gap-3">
                <Image
                  src="/gatewayz-logo-icon.png"
                  alt="Gatewayz"
                  width={32}
                  height={32}
                  className="flex-shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium mb-1">Connect Gatewayz</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Connect your Gatewayz subscription to unlock the Optimizer
                    and access multiple AI models through a single subscription.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleConnectGatewayz}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Connect Gatewayz
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Optimizer Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium">
                Enable Gatewayz Optimizer
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasGatewayz
                  ? "Automatically select the best model for each task"
                  : "Connect your Gatewayz subscription above to enable this feature"}
              </p>
            </div>
            <Switch
              checked={codeRouterSettings.enabled}
              onCheckedChange={updateCodeRouterEnabled}
              disabled={!hasGatewayz}
            />
          </div>

          {codeRouterSettings.enabled && (
            <div className="pt-2">
              <Label className="text-sm font-medium mb-3 block">
                Optimization Mode
              </Label>
              <RadioGroup
                value={codeRouterSettings.mode}
                onValueChange={(value) =>
                  updateCodeRouterMode(value as CodeRouterMode)
                }
                className="space-y-3"
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="balanced" id="mode-balanced" />
                  <div className="flex-1">
                    <Label
                      htmlFor="mode-balanced"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Balanced (Default)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Optimal balance between cost and quality (recommended)
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="price" id="mode-price" />
                  <div className="flex-1">
                    <Label
                      htmlFor="mode-price"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Price
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Minimize costs by using more efficient models when
                      possible
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="quality" id="mode-quality" />
                  <div className="flex-1">
                    <Label
                      htmlFor="mode-quality"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Performance
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Always use the highest quality models for best results
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
