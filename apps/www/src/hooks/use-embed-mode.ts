import { useState, useEffect } from "react";

/**
 * Hook to check if we're in GatewayZ embed mode (running in an iframe from GatewayZ).
 * Checks both sessionStorage (preferred in iframes due to cookie restrictions)
 * and document.cookie as fallback.
 */
export function useEmbedMode(): boolean {
  const [isEmbedMode, setIsEmbedMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check sessionStorage first (preferred for iframes)
    try {
      if (sessionStorage.getItem("gw_embed_mode") === "true") {
        setIsEmbedMode(true);
        return;
      }
    } catch {
      // sessionStorage may not be available
    }

    // Fallback to cookie check
    try {
      const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith("gw_embed_mode="))
        ?.split("=")[1];
      if (cookieValue === "true") {
        setIsEmbedMode(true);
      }
    } catch {
      // cookie access may fail
    }
  }, []);

  return isEmbedMode;
}
