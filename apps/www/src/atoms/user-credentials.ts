import { atom, useAtomValue } from "jotai";
import { getUserCredentialsAction } from "@/server-actions/user-credentials";
import { AIAgent } from "@terragon/agent/types";
import { UserCredentials } from "@terragon/shared";
import { useUserCreditBalanceQuery } from "@/queries/user-credit-balance-queries";
import { isAgentSupportedForCredits } from "@terragon/agent/utils";
import { useAccessInfo } from "@/queries/subscription";

export const userCredentialsAtom = atom<UserCredentials | null>(null);

export const userCredentialsRefetchAtom = atom(null, async (_get, set) => {
  const credentialsResult = await getUserCredentialsAction();
  if (!credentialsResult.success) {
    console.error(credentialsResult.errorMessage);
    return;
  }
  set(userCredentialsAtom, credentialsResult.data);
});

type CredentialInfo = {
  canInvokeAgent: boolean;
  hasCredentials: boolean;
  supportsCredits: boolean;
  isOutOfCredits: boolean;
};

export function useCredentialInfoForAgent(
  agent: AIAgent,
): CredentialInfo | null {
  const credentials = useAtomValue(userCredentialsAtom);
  const { isActive: hasActiveSubscription, isLoading: isLoadingSubscription } =
    useAccessInfo();
  const supportsBuiltInCredits = isAgentSupportedForCredits(agent);
  const { data: userCreditBalance } = useUserCreditBalanceQuery({
    enabled: supportsBuiltInCredits,
  });
  if (!credentials) {
    return null;
  }
  let hasCredentials = false;
  switch (agent) {
    case "claudeCode":
      hasCredentials = credentials.hasClaude;
      break;
    case "amp":
      hasCredentials = credentials.hasAmp;
      break;
    case "codex":
      hasCredentials = credentials.hasOpenAI;
      break;
    case "gemini":
      hasCredentials = false;
      break;
    case "opencode":
      hasCredentials = false;
      break;
    default:
      const _exhaustiveCheck: never = agent;
      console.warn("Unknown agent", _exhaustiveCheck);
      break;
  }

  const isOutOfCredits =
    !!userCreditBalance && userCreditBalance.balanceCents <= 0;

  // Users with an active subscription don't need credits - their subscription covers API costs
  // While loading subscription status, assume user may have subscription to prevent UI flash
  const canInvokeAgent =
    hasCredentials ||
    hasActiveSubscription ||
    isLoadingSubscription ||
    (supportsBuiltInCredits && !isOutOfCredits);

  return {
    canInvokeAgent,
    hasCredentials,
    supportsCredits: supportsBuiltInCredits,
    // Don't show "out of credits" if user has an active subscription or subscription is loading
    isOutOfCredits:
      supportsBuiltInCredits &&
      isOutOfCredits &&
      !hasActiveSubscription &&
      !isLoadingSubscription,
  };
}
