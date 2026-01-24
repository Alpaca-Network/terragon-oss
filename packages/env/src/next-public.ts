import { devDefaultAppUrl, devDefaultBroadcastPort } from "./common";

// Track if we've already warned about missing env vars to avoid log spam
let warnedBroadcastUrl = false;
let warnedBroadcastHost = false;

export function publicBroadcastUrl(): string | undefined {
  if (process.env.NODE_ENV === "development") {
    return (
      process.env.NEXT_PUBLIC_BROADCAST_URL ??
      `http://localhost:${devDefaultBroadcastPort}`
    );
  }
  if (!process.env.NEXT_PUBLIC_BROADCAST_URL) {
    if (!warnedBroadcastUrl) {
      console.warn(
        "NEXT_PUBLIC_BROADCAST_URL is not set - realtime features will be disabled",
      );
      warnedBroadcastUrl = true;
    }
    return undefined;
  }
  return process.env.NEXT_PUBLIC_BROADCAST_URL;
}

export function publicAppUrl() {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "preview") {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL}`;
  }
  if (process.env.NODE_ENV === "development") {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL;
    }
    // For local development, use the origin of the current window if available.
    // This is useful for local development when you're testing on your phone.
    if (typeof window !== "undefined" && window.location.origin) {
      return window.location.origin;
    }
    return devDefaultAppUrl;
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }
  return process.env.NEXT_PUBLIC_APP_URL;
}

export function publicBroadcastHost(): string | undefined {
  if (process.env.NODE_ENV === "development") {
    if (process.env.NEXT_PUBLIC_BROADCAST_HOST) {
      return process.env.NEXT_PUBLIC_BROADCAST_HOST;
    }
    if (typeof window !== "undefined" && window.location.hostname) {
      return `${window.location.hostname}:${devDefaultBroadcastPort}`;
    }
    return `localhost:${devDefaultBroadcastPort}`;
  }
  if (!process.env.NEXT_PUBLIC_BROADCAST_HOST) {
    if (!warnedBroadcastHost) {
      console.warn(
        "NEXT_PUBLIC_BROADCAST_HOST is not set - realtime features will be disabled",
      );
      warnedBroadcastHost = true;
    }
    return undefined;
  }
  return process.env.NEXT_PUBLIC_BROADCAST_HOST;
}

export function publicDocsUrl() {
  if (process.env.NODE_ENV === "development") {
    return process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3001";
  }
  return process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.terragonlabs.com";
}
