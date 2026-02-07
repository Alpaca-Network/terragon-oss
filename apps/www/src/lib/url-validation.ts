/**
 * URL validation utilities for preventing open redirect vulnerabilities.
 */

/**
 * Validate that the returnUrl is a safe relative path or same-origin URL.
 * Prevents open redirect vulnerabilities by only allowing:
 * 1. Relative paths starting with / (but not //)
 * 2. Absolute URLs with the same origin as baseUrl
 *
 * @param returnUrl - The URL to validate
 * @param baseUrl - The base URL to compare origins against
 * @returns A safe URL path, defaulting to /dashboard if invalid
 */
export function validateReturnUrl(returnUrl: string, baseUrl: string): string {
  // Default to dashboard if empty
  if (!returnUrl) {
    return "/dashboard";
  }

  // Allow relative paths starting with /
  // Block protocol-relative URLs (//evil.com) which could redirect to external sites
  if (returnUrl.startsWith("/") && !returnUrl.startsWith("//")) {
    return returnUrl;
  }

  // Check if it's a same-origin absolute URL
  try {
    const parsedUrl = new URL(returnUrl);
    const parsedBase = new URL(baseUrl);
    if (parsedUrl.origin === parsedBase.origin) {
      // Preserve pathname, query string, and hash fragment
      return parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
    }
  } catch {
    // Invalid URL, fall through to default
  }

  // Default to dashboard for invalid or external URLs
  return "/dashboard";
}
