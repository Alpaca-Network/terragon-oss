import { db } from "@/lib/db";
import { getAllAgentProviderCredentialRecords } from "@terragon/shared/model/agent-provider-credentials";
import { UserCredentials, GatewayZTier } from "@terragon/shared";
import * as schema from "@terragon/shared/db/schema";
import { eq } from "drizzle-orm";

export async function getUserCredentials({
  userId,
}: {
  userId: string;
}): Promise<UserCredentials> {
  // Fetch credentials and user's Gatewayz tier in parallel
  const [agentProviderCredentials, userRecord] = await Promise.all([
    getAllAgentProviderCredentialRecords({
      db,
      userId,
      isActive: true,
    }),
    db
      .select({ gwTier: schema.user.gwTier })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1),
  ]);

  const gwTier = (userRecord[0]?.gwTier as GatewayZTier) || "free";

  const result: UserCredentials = {
    hasClaude: false,
    hasAmp: false,
    hasOpenAI: false,
    hasOpenAIOAuthCredentials: false,
    gwTier,
    hasGatewayz: gwTier === "pro" || gwTier === "max",
  };

  for (const credential of agentProviderCredentials) {
    switch (credential.agent) {
      case "claudeCode":
        result.hasClaude = true;
        break;
      case "codex":
        result.hasOpenAI = true;
        result.hasOpenAIOAuthCredentials =
          result.hasOpenAIOAuthCredentials || credential.type === "oauth";
        break;
      case "amp":
        result.hasAmp = true;
        break;
    }
  }
  return result;
}
