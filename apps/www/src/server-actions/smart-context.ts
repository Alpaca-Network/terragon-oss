"use server";

import { userOnlyAction } from "@/lib/auth-server";
import { db } from "@/lib/db";
import {
  getEnvironment,
  updateEnvironment,
  getDecryptedSmartContext,
} from "@terragon/shared/model/environments";
import { encryptValue } from "@terragon/utils/encryption";
import { env } from "@terragon/env/apps-www";
import { getPostHogServer } from "@/lib/posthog-server";
import { UserFacingError } from "@/lib/server-actions";

export const getSmartContextAction = userOnlyAction(
  async function getSmartContextAction(
    userId: string,
    {
      environmentId,
    }: {
      environmentId: string;
    },
  ) {
    // Verify the user owns this environment
    const existingEnvironment = await getEnvironment({
      db,
      environmentId,
      userId,
    });
    if (!existingEnvironment) {
      throw new UserFacingError("Environment not found");
    }

    const result = await getDecryptedSmartContext({
      db,
      userId,
      environmentId,
      encryptionMasterKey: env.ENCRYPTION_MASTER_KEY,
    });

    return {
      content: result.content,
      generatedAt: result.generatedAt?.toISOString() ?? null,
    };
  },
  { defaultErrorMessage: "Failed to get smart context" },
);

export const updateSmartContextAction = userOnlyAction(
  async function updateSmartContextAction(
    userId: string,
    {
      environmentId,
      smartContext,
    }: {
      environmentId: string;
      smartContext: string | null;
    },
  ) {
    // Verify the user owns this environment
    const existingEnvironment = await getEnvironment({
      db,
      environmentId,
      userId,
    });
    if (!existingEnvironment) {
      throw new UserFacingError("Environment not found");
    }

    // Encrypt the smart context before storing (or set to null)
    const encryptedContext = smartContext
      ? encryptValue(smartContext, env.ENCRYPTION_MASTER_KEY)
      : null;

    // Update the environment with the encrypted smart context
    await updateEnvironment({
      db,
      userId,
      environmentId,
      updates: {
        smartContextEncrypted: encryptedContext,
        smartContextGeneratedAt: smartContext ? new Date() : null,
      },
    });

    // Track smart context save
    getPostHogServer().capture({
      distinctId: userId,
      event: "smart_context_saved",
      properties: {
        environmentId,
        repoFullName: existingEnvironment.repoFullName,
        hasContent: !!smartContext,
        contentLength: smartContext?.length ?? 0,
      },
    });

    return { success: true };
  },
  { defaultErrorMessage: "Failed to update smart context" },
);
