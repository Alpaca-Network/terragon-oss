import { NextRequest, NextResponse } from "next/server";
import { getUserOrNull } from "@/lib/auth-server";
import {
  getEnvironment,
  updateEnvironment,
} from "@terragon/shared/model/environments";
import { db } from "@/lib/db";
import { getUserSettings } from "@terragon/shared/model/user";
import { getGitHubUserAccessTokenWithRefresh } from "@/lib/github-oauth";
import { getFeatureFlagsForUser } from "@terragon/shared/model/feature-flags";
import { env } from "@terragon/env/apps-www";
import { getOrCreateSandbox, getSandboxProvider } from "@/agent/sandbox";
import { CreateSandboxOptions } from "@terragon/sandbox/types";
import { nonLocalhostPublicAppUrl } from "@/lib/server-utils";
import { getDefaultBranchForRepo } from "@/lib/github";
import * as z from "zod/v4";
import { getSandboxSizeForUser } from "@/lib/subscription-tiers";
import { analyzeCodebase } from "@/server-lib/smart-context-analyzer";
import { encryptValue } from "@terragon/utils/encryption";
import { getPostHogServer } from "@/lib/posthog-server";
import { getAgentProviderCredentialsDecrypted } from "@terragon/shared/model/agent-provider-credentials";

export interface AnalysisOutput {
  step: string;
  message: string;
  timestamp: string;
}

const bodySchema = z.object({
  environmentId: z.string(),
});

export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyJSON = await request.json();
  const bodyResult = bodySchema.safeParse(bodyJSON);
  if (!bodyResult.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { environmentId } = bodyResult.data;
  const userId = user.id;

  const environment = await getEnvironment({ db, environmentId, userId });
  if (!environment) {
    return NextResponse.json(
      { error: "Environment not found" },
      { status: 404 },
    );
  }

  // Create a TransformStream for SSE
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: Record<string, unknown>) => {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    await writer.write(encoder.encode(data));
  };

  const sendProgress = async (step: string, message: string) => {
    const output: AnalysisOutput = {
      step,
      message,
      timestamp: new Date().toISOString(),
    };
    await sendEvent({ type: "progress", output });
  };

  const sendComplete = async (data?: Record<string, unknown>) => {
    await sendEvent({ type: "complete", data });
    await writer.close();
  };

  const sendError = async (error: string) => {
    await sendEvent({ type: "error", error });
    await writer.close();
  };

  // Run the analysis in the background
  (async () => {
    try {
      await sendProgress("preparing", "Preparing analysis environment...");

      const [
        userSettings,
        githubAccessToken,
        preferredSandboxSize,
        featureFlags,
        defaultBranch,
        claudeCredential,
      ] = await Promise.all([
        getUserSettings({ db, userId }),
        getGitHubUserAccessTokenWithRefresh({
          db,
          userId,
          encryptionKey: env.ENCRYPTION_MASTER_KEY,
          githubClientId: env.GITHUB_CLIENT_ID,
          githubClientSecret: env.GITHUB_CLIENT_SECRET,
        }),
        getSandboxSizeForUser(userId),
        getFeatureFlagsForUser({ db, userId }),
        getDefaultBranchForRepo({
          userId,
          repoFullName: environment.repoFullName,
        }),
        getAgentProviderCredentialsDecrypted({
          db,
          userId,
          agent: "claudeCode",
          encryptionKey: env.ENCRYPTION_MASTER_KEY,
        }),
      ]);

      if (!githubAccessToken) {
        await sendError("GitHub access token not found");
        return;
      }

      // Create sandbox options
      const sandboxOptions: CreateSandboxOptions = {
        threadName: `Smart Context Analysis - ${environment.repoFullName}`,
        userName: user.name,
        userEmail: user.email,
        githubAccessToken,
        githubRepoFullName: environment.repoFullName,
        repoBaseBranchName: defaultBranch,
        userId,
        sandboxProvider: await getSandboxProvider({
          userSetting: userSettings?.sandboxProvider,
          sandboxSize: preferredSandboxSize,
          userId,
        }),
        sandboxSize: preferredSandboxSize,
        agent: null,
        createNewBranch: false,
        environmentVariables: [],
        agentCredentials: null,
        autoUpdateDaemon: false,
        skipSetupScript: true,
        publicUrl: nonLocalhostPublicAppUrl(),
        featureFlags: featureFlags,
        generateBranchName: async () => null,
        onStatusUpdate: async () => {},
      };

      await sendProgress(
        "creating",
        `Creating sandbox for ${environment.repoFullName}...`,
      );

      // Create a new sandbox
      const sandbox = await getOrCreateSandbox(null, sandboxOptions);

      await sendProgress("created", `Sandbox created: ${sandbox.sandboxId}`);

      try {
        // Wait for sandbox to be ready
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get Anthropic API key for AI analysis (if available)
        let anthropicApiKey: string | undefined;
        if (claudeCredential?.accessToken) {
          anthropicApiKey = claudeCredential.accessToken;
        } else if (env.ANTHROPIC_API_KEY) {
          anthropicApiKey = env.ANTHROPIC_API_KEY;
        }

        // Run the analysis
        const generatedContext = await analyzeCodebase({
          session: sandbox,
          repoFullName: environment.repoFullName,
          onProgress: sendProgress,
          anthropicApiKey,
        });

        // Save the generated context
        await sendProgress("saving", "Saving generated context...");

        const encryptedContext = encryptValue(
          generatedContext,
          env.ENCRYPTION_MASTER_KEY,
        );

        await updateEnvironment({
          db,
          userId,
          environmentId,
          updates: {
            smartContextEncrypted: encryptedContext,
            smartContextGeneratedAt: new Date(),
          },
        });

        // Track the analysis
        getPostHogServer().capture({
          distinctId: userId,
          event: "smart_context_generated",
          properties: {
            environmentId,
            repoFullName: environment.repoFullName,
            contentLength: generatedContext.length,
            hasAIInsights: !!anthropicApiKey,
          },
        });

        // Shutdown the sandbox
        await sendProgress("cleanup", "Shutting down sandbox...");
        try {
          await sandbox.shutdown();
        } catch (error) {
          console.error("Error shutting down sandbox:", error);
        }

        await sendComplete({
          content: generatedContext,
          generatedAt: new Date().toISOString(),
        });
      } catch (error) {
        // Make sure to shutdown sandbox on error
        try {
          await sandbox.shutdown();
        } catch {
          // Ignore shutdown errors
        }
        throw error;
      }
    } catch (error) {
      console.error("Error in codebase analysis stream:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to analyze codebase";
      await sendError(errorMessage);
    }
  })();

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
