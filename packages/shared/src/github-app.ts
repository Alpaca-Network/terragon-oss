import { App } from "@octokit/app";

let appInstance: App | null = null;

// Default timeout for GitHub API calls (10 seconds), configurable via environment variable
const GITHUB_API_TIMEOUT_MS = parseInt(
  process.env.GITHUB_API_TIMEOUT_MS || "10000",
  10,
);

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Error message to use when timeout occurs
 * @returns The result of the promise or throws a timeout error
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<"timeout">((resolve) => {
    timeoutId = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  // Attach a catch handler to prevent unhandled rejection if the original promise
  // rejects after the timeout - log for debugging purposes
  promise.catch((err) => {
    console.debug("Promise rejected after timeout:", err);
  });

  const result = await Promise.race([promise, timeoutPromise]);

  // Clear the timeout if the promise resolved before the timeout
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId);
  }

  if (result === "timeout") {
    throw new Error(errorMessage);
  }

  return result as T;
}

// Export for testing purposes only
export function resetAppInstance() {
  appInstance = null;
}

/**
 * Get or create GitHub App instance
 */
export function getGitHubApp(): App {
  if (appInstance) {
    return appInstance;
  }

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error(
      "GitHub App configuration missing: GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required",
    );
  }

  appInstance = new App({
    appId,
    privateKey: privateKey.replace(/\\n/g, "\n"), // Handle escaped newlines
  });

  return appInstance;
}

/**
 * Get installation access token for a repository
 * @param owner Repository owner
 * @param repo Repository name
 * @returns Installation access token
 */
export async function getInstallationToken(
  owner: string,
  repo: string,
): Promise<string> {
  const app = getGitHubApp();

  try {
    // Get the installation for this repository
    const { data: installation } = await withTimeout(
      app.octokit.request("GET /repos/{owner}/{repo}/installation", {
        owner,
        repo,
      }),
      GITHUB_API_TIMEOUT_MS,
      `GitHub API timeout while getting installation for ${owner}/${repo}`,
    );

    // Get an authenticated Octokit instance for this installation
    // Note: We don't need to use this octokit instance here, we're just getting the token

    // Create an installation access token with 30-day expiry
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);

    const { data: tokenData } = await withTimeout(
      app.octokit.request(
        "POST /app/installations/{installation_id}/access_tokens",
        {
          installation_id: installation.id,
          repositories: [repo],
          expires_at: expirationDate.toISOString(),
        },
      ),
      GITHUB_API_TIMEOUT_MS,
      `GitHub API timeout while creating access token for ${owner}/${repo}`,
    );

    return tokenData.token;
  } catch (error: any) {
    if (error.status === 404) {
      throw new Error(
        `GitHub App is not installed on repository ${owner}/${repo}`,
      );
    }
    throw error;
  }
}

/**
 * Check if the GitHub App is installed on a repository
 * @param owner Repository owner
 * @param repo Repository name
 * @returns Boolean indicating if app is installed
 */
export async function isAppInstalledOnRepo(
  owner: string,
  repo: string,
): Promise<boolean> {
  const app = getGitHubApp();

  try {
    await withTimeout(
      app.octokit.request("GET /repos/{owner}/{repo}/installation", {
        owner,
        repo,
      }),
      GITHUB_API_TIMEOUT_MS,
      `GitHub API timeout while checking installation status for ${owner}/${repo}`,
    );
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}
