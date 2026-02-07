import { AIModel } from "@terragon/agent/types";
import { getUserFlags } from "@terragon/shared/model/user-flags";
import { getUserSettings } from "@terragon/shared/model/user";
import { getUserCredentials } from "./user-credentials";
import { getDefaultModel as getDefaultModelLib } from "@/lib/default-ai-model";
import { db } from "@/lib/db";

export async function getDefaultModel({
  userId,
}: {
  userId: string;
}): Promise<AIModel> {
  const [userFlags, userCredentials, userSettings] = await Promise.all([
    getUserFlags({ db, userId }),
    getUserCredentials({ userId }),
    getUserSettings({ db, userId }),
  ]);
  return getDefaultModelLib({
    userCredentials,
    userFlags,
    codeRouterSettings: userSettings?.codeRouterSettings,
  });
}
