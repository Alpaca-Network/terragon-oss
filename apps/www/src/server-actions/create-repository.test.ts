import { describe, expect, it, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createTestUser } from "@terragon/shared/model/test-helpers";
import {
  mockLoggedInUser,
  mockWaitUntil,
  waitUntilResolved,
} from "@/test-helpers/mock-next";
import { createRepositoryFromTemplate } from "./create-repository";
import * as githubOauthModule from "@/lib/github-oauth";
import { unwrapResult } from "@/lib/server-actions";

// Mock the GitHub OAuth module
vi.mock("@/lib/github-oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof githubOauthModule>();
  return {
    ...actual,
    getGitHubUserAccessTokenWithRefresh: vi
      .fn()
      .mockResolvedValue("mock-token"),
  };
});

// Mock PostHog
vi.mock("@/lib/posthog-server", () => ({
  getPostHogServer: vi.fn(() => ({ capture: vi.fn() })),
}));

// Mock newThread
vi.mock("./new-thread", () => ({
  newThread: vi.fn().mockResolvedValue({
    success: true,
    data: { threadId: "mock-thread-id" },
  }),
}));

// Mock Octokit
const mockOctokit = {
  rest: {
    users: {
      getAuthenticated: vi.fn(),
    },
    repos: {
      get: vi.fn(),
      createUsingTemplate: vi.fn(),
      createFork: vi.fn(),
      update: vi.fn(),
    },
  },
};

vi.mock("octokit", () => ({
  Octokit: vi.fn(() => mockOctokit),
}));

describe("createRepositoryFromTemplate", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: "testuser" },
    });
  });

  it("should use createUsingTemplate when source repo is a GitHub template", async () => {
    const { session } = await createTestUser({ db });
    await mockWaitUntil();
    await mockLoggedInUser(session);

    // Source repo is a template
    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: {
        is_template: true,
        full_name: "owner/template-repo",
      },
    });

    // Template creation succeeds
    mockOctokit.rest.repos.createUsingTemplate.mockResolvedValue({
      data: {
        full_name: "testuser/my-new-repo",
        default_branch: "main",
      },
    });

    const result = await createRepositoryFromTemplate({
      templateOwner: "owner",
      templateRepo: "template-repo",
      repoName: "my-new-repo",
      isPrivate: true,
      suggestedFirstTask: "Initialize the project",
    });
    await waitUntilResolved();

    expect(result.success).toBe(true);
    const data = unwrapResult(result);
    expect(data.repoFullName).toBe("testuser/my-new-repo");
    expect(mockOctokit.rest.repos.createUsingTemplate).toHaveBeenCalledWith({
      template_owner: "owner",
      template_repo: "template-repo",
      owner: "testuser",
      name: "my-new-repo",
      private: true,
      description: "Created from owner/template-repo",
    });
    expect(mockOctokit.rest.repos.createFork).not.toHaveBeenCalled();
  });

  it("should fall back to forking when source repo is not a template", async () => {
    const { session } = await createTestUser({ db });
    await mockWaitUntil();
    await mockLoggedInUser(session);

    // Source repo is NOT a template (first call checks is_template)
    // Subsequent calls are for polling fork readiness and fetching updated info
    mockOctokit.rest.repos.get
      .mockResolvedValueOnce({
        data: {
          is_template: false,
          full_name: "vercel/next.js",
        },
      })
      // Polling call - fork is ready
      .mockResolvedValueOnce({
        data: {
          full_name: "testuser/next.js",
          default_branch: "main",
          private: false,
          size: 1000,
        },
      })
      // Final fetch for updated repo info
      .mockResolvedValueOnce({
        data: {
          full_name: "testuser/next.js",
          default_branch: "main",
          private: false,
        },
      });

    // Fork succeeds - note that forks keep the same name as the source repo
    mockOctokit.rest.repos.createFork.mockResolvedValue({
      data: {
        full_name: "testuser/next.js",
        name: "next.js",
        default_branch: "main",
        private: false,
      },
    });

    const result = await createRepositoryFromTemplate({
      templateOwner: "vercel",
      templateRepo: "next.js",
      repoName: "my-nextjs-app", // This parameter is ignored for forks
      isPrivate: false,
      suggestedFirstTask: "Set up authentication",
    });
    await waitUntilResolved();

    expect(result.success).toBe(true);
    const data = unwrapResult(result);
    expect(data.repoFullName).toBe("testuser/next.js");
    expect(mockOctokit.rest.repos.createFork).toHaveBeenCalledWith({
      owner: "vercel",
      repo: "next.js",
      default_branch_only: true,
    });
    expect(mockOctokit.rest.repos.createUsingTemplate).not.toHaveBeenCalled();
  });

  it("should attempt to make forked repo private when requested", async () => {
    const { session } = await createTestUser({ db });
    await mockWaitUntil();
    await mockLoggedInUser(session);

    // Source repo is NOT a template
    mockOctokit.rest.repos.get
      .mockResolvedValueOnce({
        data: {
          is_template: false,
          full_name: "owner/repo",
        },
      })
      // Polling call - fork is ready
      .mockResolvedValueOnce({
        data: {
          full_name: "testuser/my-repo",
          default_branch: "main",
          private: false,
          size: 1000,
        },
      })
      // Final fetch for updated repo info (after making private)
      .mockResolvedValueOnce({
        data: {
          full_name: "testuser/my-repo",
          default_branch: "main",
          private: true,
        },
      });

    // Fork succeeds but is public
    mockOctokit.rest.repos.createFork.mockResolvedValue({
      data: {
        full_name: "testuser/my-repo",
        name: "my-repo",
        default_branch: "main",
        private: false,
      },
    });

    // Update to private succeeds
    mockOctokit.rest.repos.update.mockResolvedValue({
      data: { private: true },
    });

    const result = await createRepositoryFromTemplate({
      templateOwner: "owner",
      templateRepo: "repo",
      repoName: "my-repo",
      isPrivate: true,
      suggestedFirstTask: "Initialize",
    });
    await waitUntilResolved();

    expect(result.success).toBe(true);
    expect(mockOctokit.rest.repos.update).toHaveBeenCalledWith({
      owner: "testuser",
      repo: "my-repo",
      private: true,
    });
  });

  it("should continue if making forked repo private fails and show warning in message", async () => {
    const { session } = await createTestUser({ db });
    await mockWaitUntil();
    await mockLoggedInUser(session);

    // Source repo is NOT a template
    mockOctokit.rest.repos.get
      .mockResolvedValueOnce({
        data: {
          is_template: false,
          full_name: "owner/repo",
        },
      })
      // Polling call - fork is ready
      .mockResolvedValueOnce({
        data: {
          full_name: "testuser/my-repo",
          default_branch: "main",
          private: false,
          size: 1000,
        },
      })
      // Final fetch - still public because update failed
      .mockResolvedValueOnce({
        data: {
          full_name: "testuser/my-repo",
          default_branch: "main",
          private: false,
        },
      });

    // Fork succeeds but is public
    mockOctokit.rest.repos.createFork.mockResolvedValue({
      data: {
        full_name: "testuser/my-repo",
        name: "my-repo",
        default_branch: "main",
        private: false,
      },
    });

    // Update to private fails (e.g., free plan)
    mockOctokit.rest.repos.update.mockRejectedValue(new Error("Forbidden"));

    const result = await createRepositoryFromTemplate({
      templateOwner: "owner",
      templateRepo: "repo",
      repoName: "my-repo",
      isPrivate: true,
      suggestedFirstTask: "Initialize",
    });
    await waitUntilResolved();

    // Should still succeed but with privacy warning in message
    expect(result.success).toBe(true);
    const data = unwrapResult(result);
    expect(data.message).toContain("could not be made private");
  });

  it("should return user-friendly error when source repo is not found", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    const error = new Error("Not Found") as any;
    error.status = 404;
    mockOctokit.rest.repos.get.mockRejectedValue(error);

    const result = await createRepositoryFromTemplate({
      templateOwner: "nonexistent",
      templateRepo: "repo",
      repoName: "my-repo",
      isPrivate: false,
      suggestedFirstTask: "Initialize",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain(
      "Repository nonexistent/repo not found",
    );
  });

  it("should return user-friendly error when repo name is taken", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: {
        is_template: true,
        full_name: "owner/template",
      },
    });

    const error = new Error("Unprocessable Entity") as any;
    error.status = 422;
    mockOctokit.rest.repos.createUsingTemplate.mockRejectedValue(error);

    const result = await createRepositoryFromTemplate({
      templateOwner: "owner",
      templateRepo: "template",
      repoName: "existing-repo",
      isPrivate: false,
      suggestedFirstTask: "Initialize",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain(
      'Repository name "existing-repo" is already taken or invalid',
    );
  });

  it("should return user-friendly error when access is denied", async () => {
    const { session } = await createTestUser({ db });
    await mockLoggedInUser(session);

    mockOctokit.rest.repos.get.mockResolvedValueOnce({
      data: {
        is_template: false,
        full_name: "private-org/repo",
      },
    });

    const error = new Error("Forbidden") as any;
    error.status = 403;
    mockOctokit.rest.repos.createFork.mockRejectedValue(error);

    const result = await createRepositoryFromTemplate({
      templateOwner: "private-org",
      templateRepo: "repo",
      repoName: "my-repo",
      isPrivate: false,
      suggestedFirstTask: "Initialize",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("Access denied");
  });
});
