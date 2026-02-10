"use client";

import { useDynamicFavicon } from "@/hooks/use-dynamic-favicon";
import { useAtomValue } from "jotai";
import { userAtom } from "@/atoms/user";

/**
 * Provider component that manages the dynamic favicon with review task count.
 * This component should be placed high in the component tree (e.g., in Providers)
 * to ensure the favicon updates globally across the app.
 *
 * Only activates when a user is logged in.
 */
export function DynamicFaviconProvider() {
  const user = useAtomValue(userAtom);

  // Only render the inner component when user is logged in
  // This avoids calling the hook when there's no user
  if (!user) {
    return null;
  }

  return <DynamicFaviconInner />;
}

// Separate component to properly handle conditional hook usage
function DynamicFaviconInner() {
  useDynamicFavicon();
  return null;
}
