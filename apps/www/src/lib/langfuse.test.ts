import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the langfuse module
vi.mock("langfuse", () => {
  const mockGeneration = vi.fn();
  const mockSpan = vi.fn();
  const mockTrace = vi.fn().mockReturnValue({
    generation: mockGeneration,
    span: mockSpan,
  });
  const MockLangfuse = vi.fn().mockImplementation(() => ({
    trace: mockTrace,
    shutdownAsync: vi.fn().mockResolvedValue(undefined),
  }));
  return { Langfuse: MockLangfuse };
});

// Mock the env module
vi.mock("@terragon/env/apps-www", () => ({
  env: {
    LANGFUSE_SECRET_KEY: "",
    LANGFUSE_PUBLIC_KEY: "",
    LANGFUSE_HOST: "https://cloud.langfuse.com",
  },
}));

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: {},
}));

// Mock the feature flags module
vi.mock("@terragon/shared/model/feature-flags", () => ({
  getFeatureFlagGlobalOverride: vi.fn().mockResolvedValue(false),
}));

describe("langfuse", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("isLangfuseConfigured", () => {
    it("returns false when LANGFUSE_SECRET_KEY is not set", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "",
          LANGFUSE_PUBLIC_KEY: "pk-test",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { isLangfuseConfigured } = await import("./langfuse");
      expect(isLangfuseConfigured()).toBe(false);
    });

    it("returns false when LANGFUSE_PUBLIC_KEY is not set", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "sk-test",
          LANGFUSE_PUBLIC_KEY: "",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { isLangfuseConfigured } = await import("./langfuse");
      expect(isLangfuseConfigured()).toBe(false);
    });

    it("returns true when both keys are set", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "sk-test",
          LANGFUSE_PUBLIC_KEY: "pk-test",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { isLangfuseConfigured } = await import("./langfuse");
      expect(isLangfuseConfigured()).toBe(true);
    });
  });

  describe("getLangfuse", () => {
    it("returns null when Langfuse is not configured", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "",
          LANGFUSE_PUBLIC_KEY: "",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { getLangfuse } = await import("./langfuse");
      expect(getLangfuse()).toBeNull();
    });

    it("returns Langfuse instance when configured", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "sk-test",
          LANGFUSE_PUBLIC_KEY: "pk-test",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { getLangfuse } = await import("./langfuse");
      const instance = getLangfuse();
      expect(instance).not.toBeNull();
    });

    it("returns the same instance on subsequent calls (singleton)", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "sk-test",
          LANGFUSE_PUBLIC_KEY: "pk-test",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { getLangfuse } = await import("./langfuse");
      const instance1 = getLangfuse();
      const instance2 = getLangfuse();
      expect(instance1).toBe(instance2);
    });
  });

  describe("traceGeneration", () => {
    it("does not trace when Langfuse is not configured", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "",
          LANGFUSE_PUBLIC_KEY: "",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { Langfuse } = await import("langfuse");
      const { traceGeneration } = await import("./langfuse");

      traceGeneration({
        name: "test-generation",
        userId: "user-123",
        model: "claude-3-opus",
        provider: "anthropic",
      });

      // Wait for async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Langfuse should not be instantiated when not configured
      expect(Langfuse).not.toHaveBeenCalled();
    });

    it("does not trace when feature flag is disabled", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "sk-test",
          LANGFUSE_PUBLIC_KEY: "pk-test",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { getFeatureFlagGlobalOverride } = await import(
        "@terragon/shared/model/feature-flags"
      );
      vi.mocked(getFeatureFlagGlobalOverride).mockResolvedValue(false);

      const { traceGeneration, getLangfuse } = await import("./langfuse");

      traceGeneration({
        name: "test-generation",
        userId: "user-123",
        model: "claude-3-opus",
        provider: "anthropic",
      });

      // Wait for async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Langfuse trace should not be called when feature flag is disabled
      const langfuse = getLangfuse();
      expect(langfuse?.trace).not.toHaveBeenCalled();
    });

    it("traces generation when configured and feature flag is enabled", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "sk-test",
          LANGFUSE_PUBLIC_KEY: "pk-test",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { getFeatureFlagGlobalOverride } = await import(
        "@terragon/shared/model/feature-flags"
      );
      vi.mocked(getFeatureFlagGlobalOverride).mockResolvedValue(true);

      const { traceGeneration, getLangfuse } = await import("./langfuse");

      traceGeneration({
        name: "test-generation",
        userId: "user-123",
        model: "claude-3-opus",
        provider: "anthropic",
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        metadata: {
          path: "/v1/messages",
        },
      });

      // Wait for async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const langfuse = getLangfuse();
      expect(langfuse?.trace).toHaveBeenCalledWith({
        id: undefined,
        name: "test-generation",
        userId: "user-123",
        sessionId: undefined,
        metadata: {
          path: "/v1/messages",
        },
      });
    });
  });

  describe("traceSpan", () => {
    it("does not trace when Langfuse is not configured", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "",
          LANGFUSE_PUBLIC_KEY: "",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { Langfuse } = await import("langfuse");
      const { traceSpan } = await import("./langfuse");

      traceSpan({
        name: "test-span",
        userId: "user-123",
      });

      // Wait for async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(Langfuse).not.toHaveBeenCalled();
    });
  });

  describe("shutdownLangfuse", () => {
    it("does nothing when Langfuse is not initialized", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "",
          LANGFUSE_PUBLIC_KEY: "",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { shutdownLangfuse } = await import("./langfuse");
      await expect(shutdownLangfuse()).resolves.not.toThrow();
    });

    it("calls shutdownAsync when Langfuse is initialized", async () => {
      vi.doMock("@terragon/env/apps-www", () => ({
        env: {
          LANGFUSE_SECRET_KEY: "sk-test",
          LANGFUSE_PUBLIC_KEY: "pk-test",
          LANGFUSE_HOST: "https://cloud.langfuse.com",
        },
      }));

      const { getLangfuse, shutdownLangfuse } = await import("./langfuse");

      // Initialize langfuse
      const instance = getLangfuse();
      expect(instance).not.toBeNull();

      // Shutdown
      await shutdownLangfuse();

      expect(instance?.shutdownAsync).toHaveBeenCalled();
    });
  });
});
