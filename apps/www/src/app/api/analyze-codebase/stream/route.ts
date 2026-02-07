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
import { checkSmartContextAnalysisRateLimit } from "@/lib/rate-limit";

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

  let bodyJSON: unknown;
  try {
    bodyJSON = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }

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

  // Check rate limit
  try {
    await checkSmartContextAnalysisRateLimit(userId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Rate limit exceeded";
    return NextResponse.json({ error: message }, { status: 429 });
  }

  // Create a TransformStream for SSE
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Track if stream is still open to prevent writes after client disconnection
  let isStreamClosed = false;
  // Track sandbox for cleanup on disconnection
  let activeSandbox: { shutdown: () => Promise<void> } | null = null;

  // Handle client disconnection via AbortSignal
  request.signal.addEventListener("abort", () => {
    isStreamClosed = true;
    // Clean up sandbox if client disconnects
    if (activeSandbox) {
      activeSandbox.shutdown().catch((err) => {
        console.error(
          "Error shutting down sandbox after client disconnect:",
          err,
        );
      });
      activeSandbox = null;
    }
  });

  const sendEvent = async (event: Record<string, unknown>) => {
    if (isStreamClosed) return; // Don't write to closed stream
    try {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      await writer.write(encoder.encode(data));
    } catch (error) {
      // Stream likely closed by client
      isStreamClosed = true;
      console.error(
        "Error writing to stream (client may have disconnected):",
        error,
      );
    }
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
    if (isStreamClosed) return;
    await sendEvent({ type: "complete", data });
    try {
      await writer.close();
    } catch {
      // Stream already closed
    }
    isStreamClosed = true;
  };

  const sendError = async (error: string) => {
    if (isStreamClosed) return;
    await sendEvent({ type: "error", error });
    try {
      await writer.close();
    } catch {
      // Stream already closed
    }
    isStreamClosed = true;
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
      activeSandbox = sandbox; // Track for cleanup on client disconnect

      await sendProgress("created", `Sandbox created: ${sandbox.sandboxId}`);

      try {
        // Verify sandbox is ready by running a simple command
        await sendProgress("verifying", "Verifying sandbox is ready...");
        await sandbox.runCommand("echo ready", { timeoutMs: 10000 });

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
          activeSandbox = null; // Clear after successful shutdown
        } catch (error) {
          console.error("Error shutting down sandbox:", error);
          activeSandbox = null;
        }

        await sendComplete({
          content: generatedContext,
          generatedAt: new Date().toISOString(),
        });
      } catch (error) {
        // Make sure to shutdown sandbox on error
        try {
          await sandbox.shutdown();
          activeSandbox = null;
        } catch (shutdownError) {
          console.error(
            "Error shutting down sandbox after failure:",
            shutdownError,
          );
          activeSandbox = null;
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
