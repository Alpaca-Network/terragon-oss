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
import * as z from "zod/v4";

// Max smart context size: 100KB
const MAX_SMART_CONTEXT_LENGTH = 100 * 1024;

const getSmartContextSchema = z.object({
  environmentId: z.string().min(1, "Environment ID is required"),
});

const updateSmartContextSchema = z.object({
  environmentId: z.string().min(1, "Environment ID is required"),
  smartContext: z
    .string()
    .max(MAX_SMART_CONTEXT_LENGTH, "Smart context exceeds maximum size (100KB)")
    .nullable(),
});

export const getSmartContextAction = userOnlyAction(
  async function getSmartContextAction(
    userId: string,
    input: {
      environmentId: string;
    },
  ) {
    // Validate input
    const parseResult = getSmartContextSchema.safeParse(input);
    if (!parseResult.success) {
      throw new UserFacingError(
        parseResult.error.issues[0]?.message ?? "Invalid input",
      );
    }
    const { environmentId } = parseResult.data;

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
    input: {
      environmentId: string;
      smartContext: string | null;
    },
  ) {
    // Validate input
    const parseResult = updateSmartContextSchema.safeParse(input);
    if (!parseResult.success) {
      throw new UserFacingError(
        parseResult.error.issues[0]?.message ?? "Invalid input",
      );
    }
    const { environmentId, smartContext } = parseResult.data;

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
