"use client";

import { useEffect } from "react";
import { UserCookies } from "@/lib/cookies";
import {
  bearerTokenAtom,
  userAtom,
  userSettingsAtom,
  userSettingsRefetchAtom,
  impersonationAtom,
  ImpersonationInfo,
  userFeatureFlagsAtom,
} from "@/atoms/user";
import { userCookiesInitAtom, timeZoneAtom } from "@/atoms/user-cookies";
import { userFlagsAtom, userFlagsRefetchAtom } from "@/atoms/user-flags";
import { useHydrateAtoms } from "jotai/utils";
import {
  User,
  UserSettings,
  UserFlags,
  UserCredentials,
} from "@terragon/shared";
import { useRealtimeUser } from "@/hooks/useRealtime";
import { useAtom, useSetAtom } from "jotai";
import posthog from "posthog-js";
import {
  userCredentialsAtom,
  userCredentialsRefetchAtom,
} from "@/atoms/user-credentials";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function UserAtomsHydrator({
  user,
  userSettings,
  userFlags,
  userCredentials,
  bearerToken,
  impersonation,
  userFeatureFlags,
  userCookies,
  children,
}: {
  user: User | null;
  userSettings: UserSettings | null;
  userFlags: UserFlags | null;
  userCredentials: UserCredentials | null;
  bearerToken: string | null;
  userFeatureFlags: Record<string, boolean>;
  userCookies: UserCookies;
  impersonation?: ImpersonationInfo;
  children: React.ReactNode;
}) {
  useHydrateAtoms([
    [userAtom, user],
    [userSettingsAtom, userSettings],
    [userFlagsAtom, userFlags],
    [userCredentialsAtom, userCredentials],
    [bearerTokenAtom, bearerToken],
    [impersonationAtom, impersonation || { isImpersonating: false }],
    [userFeatureFlagsAtom, userFeatureFlags],
    [userCookiesInitAtom, userCookies],
  ]);

  const [timeZone, setTimeZone] = useAtom(timeZoneAtom);
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const currentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone !== currentTimeZone) {
      setTimeZone(currentTimeZone);
    }
  }, [timeZone, setTimeZone]);

  const refetchUserSettings = useSetAtom(userSettingsRefetchAtom);
  const refetchUserFlags = useSetAtom(userFlagsRefetchAtom);
  const refetchUserCredentials = useSetAtom(userCredentialsRefetchAtom);
  const router = useRouter();

  useRealtimeUser({
    matches: (message) => !!message.data.userSettings,
    onMessage: () => refetchUserSettings(),
  });
  useRealtimeUser({
    matches: (message) => !!message.data.userFlags,
    onMessage: () => refetchUserFlags(),
  });
  useRealtimeUser({
    matches: (message) => !!message.data.userCredentials,
    onMessage: () => refetchUserCredentials(),
  });

  // Show toast notification when task is auto-archived
  useRealtimeUser({
    matches: (message) =>
      message.data.notificationReason === "task-archived" &&
      message.data.isThreadUnread === true &&
      !!message.data.threadId,
    onMessage: (message) => {
      // Guard against undefined threadId (TypeScript doesn't narrow across callbacks)
      const threadId = message.data.threadId;
      if (!threadId) return;

      const threadName = message.data.threadName || "Task";

      // Use unique ID to prevent duplicate toasts for the same event
      toast.success(`${threadName} completed and archived`, {
        id: `task-archived-${threadId}`,
        duration: 5000,
        action: {
          label: "View in archived",
          onClick: () => router.push("/archived"),
        },
      });
    },
  });
  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        name: user.name,
        email: user.email,
      });
    }
  }, [user]);
  return children;
}
