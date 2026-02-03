import { AIModel, CodeRouterSettings } from "@terragon/agent/types";
import {
  getDefaultModelForAgent,
  getCodeRouterModelForMode,
} from "@terragon/agent/utils";
import { UserCredentials } from "@terragon/shared";
import { UserFlags } from "@terragon/shared";

export function getDefaultModel({
  userCredentials,
  userFlags,
  codeRouterSettings,
}: {
  userCredentials: Pick<
    UserCredentials,
    "hasClaude" | "hasOpenAI" | "hasAmp" | "hasGatewayz"
  > | null;
  userFlags: UserFlags | null;
  codeRouterSettings?: CodeRouterSettings | null;
}): AIModel {
  if (userFlags?.selectedModel) {
    return userFlags.selectedModel;
  }
  // If Code Router is enabled and user has Gatewayz, use Code Router as default
  if (codeRouterSettings?.enabled && userCredentials?.hasGatewayz) {
    return getCodeRouterModelForMode(codeRouterSettings.mode);
  }
  if (!userCredentials?.hasClaude && userCredentials?.hasOpenAI) {
    return getDefaultModelForAgent({ agent: "codex", agentVersion: "latest" });
  }
  if (!userCredentials?.hasClaude && userCredentials?.hasAmp) {
    return getDefaultModelForAgent({ agent: "amp", agentVersion: "latest" });
  }
  return getDefaultModelForAgent({
    agent: "claudeCode",
    agentVersion: "latest",
  });
}

export function getCannotUseOpus({
  userFlags,
}: {
  userFlags: UserFlags | null;
}): boolean {
  // Opus is now available for all Claude Pro subscribers
  return false;
}
