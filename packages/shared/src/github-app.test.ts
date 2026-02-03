import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getGitHubApp,
  isAppInstalledOnRepo,
  getInstallationToken,
  resetAppInstance,
} from "./github-app.js";

describe("GitHub App", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetAppInstance();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    resetAppInstance();
  });

  describe("getGitHubApp", () => {
    it("should throw error when GITHUB_APP_ID is missing", () => {
      delete process.env.GITHUB_APP_ID;
      process.env.GITHUB_APP_PRIVATE_KEY = "fake-key";

      expect(() => getGitHubApp()).toThrow("GitHub App configuration missing");
    });

    it("should throw error when GITHUB_APP_PRIVATE_KEY is missing", () => {
      process.env.GITHUB_APP_ID = "123456";
      delete process.env.GITHUB_APP_PRIVATE_KEY;

      expect(() => getGitHubApp()).toThrow("GitHub App configuration missing");
    });

    it("should create App instance when both env vars are present", () => {
      process.env.GITHUB_APP_ID = "123456";
      process.env.GITHUB_APP_PRIVATE_KEY = "fake-private-key";

      // The App constructor doesn't validate the private key format immediately
      // It only validates when trying to use it for signing JWTs
      // So we should test that it creates an App instance successfully
      const app = getGitHubApp();
      expect(app).toBeDefined();
      expect(app).toHaveProperty("octokit");
    });
  });

  describe("isAppInstalledOnRepo", () => {
    it("should handle missing app configuration gracefully", async () => {
      delete process.env.GITHUB_APP_ID;
      delete process.env.GITHUB_APP_PRIVATE_KEY;

      await expect(isAppInstalledOnRepo("owner", "repo")).rejects.toThrow(
        "GitHub App configuration missing",
      );
    });

    it("should timeout when GitHub API is slow", async () => {
      process.env.GITHUB_APP_ID = "123456";
      process.env.GITHUB_APP_PRIVATE_KEY = "fake-private-key";

      const app = getGitHubApp();
      // Mock the request to resolve after a very long delay (simulating a hung connection)
      vi.spyOn(app.octokit, "request").mockImplementation(
        () =>
          new Promise((resolve) => {
            // Resolve after 20 seconds (longer than timeout)
            setTimeout(
              () =>
                resolve({
                  data: { id: 123 },
                  status: 200,
                  headers: {},
                  url: "",
                }),
              20000,
            );
          }),
      );

      // Use fake timers to fast-forward through the timeout
      vi.useFakeTimers();

      let error: Error | null = null;
      const promise = isAppInstalledOnRepo("owner", "repo").catch((e) => {
        error = e;
      });

      // Fast-forward past the timeout (10 seconds)
      await vi.advanceTimersByTimeAsync(11000);
      await promise;

      expect(error).not.toBeNull();
      expect(error!.message).toBe(
        "GitHub API timeout while checking installation status for owner/repo",
      );

      vi.useRealTimers();
    });

    it("should return true when app is installed", async () => {
      process.env.GITHUB_APP_ID = "123456";
      process.env.GITHUB_APP_PRIVATE_KEY = "fake-private-key";

      const app = getGitHubApp();
      vi.spyOn(app.octokit, "request").mockResolvedValue({
        data: { id: 123 },
        status: 200,
        headers: {},
        url: "",
      });

      const result = await isAppInstalledOnRepo("owner", "repo");
      expect(result).toBe(true);
    });

    it("should return false when app is not installed (404)", async () => {
      process.env.GITHUB_APP_ID = "123456";
      process.env.GITHUB_APP_PRIVATE_KEY = "fake-private-key";

      const app = getGitHubApp();
      vi.spyOn(app.octokit, "request").mockRejectedValue({ status: 404 });

      const result = await isAppInstalledOnRepo("owner", "repo");
      expect(result).toBe(false);
    });
  });

  describe("getInstallationToken", () => {
    it("should timeout when GitHub API is slow during installation lookup", async () => {
      process.env.GITHUB_APP_ID = "123456";
      process.env.GITHUB_APP_PRIVATE_KEY = "fake-private-key";

      const app = getGitHubApp();
      // Mock the request to resolve after a very long delay
      vi.spyOn(app.octokit, "request").mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  data: { id: 123 },
                  status: 200,
                  headers: {},
                  url: "",
                }),
              20000,
            );
          }),
      );

      vi.useFakeTimers();

      let error: Error | null = null;
      const promise = getInstallationToken("owner", "repo").catch((e) => {
        error = e;
      });

      // Fast-forward past the timeout (10 seconds)
      await vi.advanceTimersByTimeAsync(11000);
      await promise;

      expect(error).not.toBeNull();
      expect(error!.message).toBe(
        "GitHub API timeout while getting installation for owner/repo",
      );

      vi.useRealTimers();
    });

    it("should timeout when GitHub API is slow during token creation", async () => {
      process.env.GITHUB_APP_ID = "123456";
      process.env.GITHUB_APP_PRIVATE_KEY = "fake-private-key";

      const app = getGitHubApp();

      let callCount = 0;
      vi.spyOn(app.octokit, "request").mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call (get installation) succeeds quickly
          return Promise.resolve({
            data: { id: 12345 },
            status: 200,
            headers: {},
            url: "",
          });
        } else {
          // Second call (create token) takes too long
          return new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  data: { token: "test_token" },
                  status: 201,
                  headers: {},
                  url: "",
                }),
              20000,
            );
          });
        }
      });

      vi.useFakeTimers();

      let error: Error | null = null;
      const promise = getInstallationToken("owner", "repo").catch((e) => {
        error = e;
      });

      // Fast-forward past the timeout (10 seconds)
      await vi.advanceTimersByTimeAsync(11000);
      await promise;

      expect(error).not.toBeNull();
      expect(error!.message).toBe(
        "GitHub API timeout while creating access token for owner/repo",
      );

      vi.useRealTimers();
    });

    it("should return token when both API calls succeed", async () => {
      process.env.GITHUB_APP_ID = "123456";
      process.env.GITHUB_APP_PRIVATE_KEY = "fake-private-key";

      const app = getGitHubApp();

      let callCount = 0;
      vi.spyOn(app.octokit, "request").mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call (get installation)
          return Promise.resolve({
            data: { id: 12345 },
            status: 200,
            headers: {},
            url: "",
          });
        } else {
          // Second call (create token)
          return Promise.resolve({
            data: { token: "ghs_test_token_123" },
            status: 201,
            headers: {},
            url: "",
          });
        }
      });

      const token = await getInstallationToken("owner", "repo");
      expect(token).toBe("ghs_test_token_123");
    });
  });
});
