"use client";

import { useEffect } from "react";
import { useEmbedMode } from "@/hooks/use-embed-mode";

/**
 * Component that updates the favicon to Gatewayz logo when in embed mode.
 * Must be rendered inside the document body.
 */
export function EmbedModeFavicon() {
  const isEmbedMode = useEmbedMode();

  useEffect(() => {
    if (!isEmbedMode) return;

    // Update favicon to Gatewayz logo when in embed mode
    const favicon = document.querySelector(
      "link[rel*='icon']",
    ) as HTMLLinkElement;
    if (favicon) {
      favicon.href = "/gatewayz-logo-icon.png";
    }
  }, [isEmbedMode]);

  return null;
}
