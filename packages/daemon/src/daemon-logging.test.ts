import { DaemonMessageClaude } from "./shared";
import { DaemonRuntime, writeToUnixSocket } from "./runtime";
import { TerragonDaemon } from "./daemon";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  MockInstance,
} from "vitest";
import { nanoid } from "nanoid/non-secure";

async function sleep(ms: number = 10) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepUntil(condition: () => boolean, maxWaitMs: number = 2000) {
  const startTime = Date.now();
  while (!condition()) {
    await sleep(100);
    if (Date.now() - startTime > maxWaitMs) {
      throw new Error("Timeout waiting for condition");
    }
  }
}

const TEST_INPUT_MESSAGE: DaemonMessageClaude = {
  type: "claude",
  model: "opus",
  agent: "claudeCode",
  agentVersion: 0,
  token: "TEST_TOKEN_STRING",
  prompt: "TEST_PROMPT_STRING",
  sessionId: null,
  threadId: "TEST_THREAD_ID_STRING",
  threadChatId: "TEST_THREAD_CHAT_ID_STRING",
};

function setupRuntime() {
  const unixSocketPath = `/tmp/terragon-daemon-${nanoid()}.sock`;
  const runtime = new DaemonRuntime({
    url: "http://localhost:3000",
    unixSocketPath,
    outputFormat: "json",
  });

  vi.spyOn(runtime, "exitProcess").mockImplementation(() => {});
  vi.spyOn(runtime, "killChildProcessGroup").mockImplementation(() => {});
  vi.spyOn(runtime, "execSync").mockReturnValue("NOT_EXISTS\n");
  vi.spyOn(runtime, "readFileSync").mockImplementation((path: string) => {
    if (path.endsWith("/.git-credentials")) {
      throw new Error("File not found");
    }
    throw new Error(`Unexpected call to readFileSync: ${path}`);
  });
  vi.spyOn(runtime, "appendFileSync").mockImplementation(() => {
    throw new Error("Unexpected call to appendFileSync");
  });

  return runtime;
}

describe("daemon logging", () => {
  let runtime: DaemonRuntime;
  let daemon: TerragonDaemon;
  let loggerInfoSpy: MockInstance;
  let loggerErrorSpy: MockInstance;
  let loggerWarnSpy: MockInstance;
  let spawnCommandLineMock: MockInstance<DaemonRuntime["spawnCommandLine"]>;
  let serverPostMock: MockInstance<DaemonRuntime["serverPost"]>;
  let spawnPid = 1234;

  beforeEach(() => {
    vi.stubGlobal("Intl", {
      ...Intl,
      DateTimeFormat: vi.fn(() => ({
        resolvedOptions: () => ({ timeZone: "America/New_York" }),
      })),
    });

    runtime = setupRuntime();

    // Spy on logger methods
    loggerInfoSpy = vi.spyOn(runtime.logger, "info");
    loggerErrorSpy = vi.spyOn(runtime.logger, "error");
    loggerWarnSpy = vi.spyOn(runtime.logger, "warn");

    vi.spyOn(runtime, "listenToUnixSocket");
    spawnCommandLineMock = vi
      .spyOn(runtime, "spawnCommandLine")
      .mockImplementation(() => ({
        processId: ++spawnPid,
        pollInterval: undefined,
      }));
    serverPostMock = vi.spyOn(runtime, "serverPost").mockResolvedValue();

    daemon = new TerragonDaemon({
      runtime,
      messageHandleDelay: 5,
      messageFlushDelay: 10,
      retryConfig: {
        baseDelayMs: 10,
        maxDelayMs: 100,
        maxAttempts: 10,
        backoffMultiplier: 2,
        jitterFactor: 0,
      },
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    await runtime.teardown();
  });

  describe("startup logging", () => {
    it("should log daemon startup sequence", async () => {
      await daemon.start();

      expect(loggerInfoSpy).toHaveBeenCalledWith(
        "🚀 Starting Terragon Daemon...",
      );
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        "Daemon version",
        expect.objectContaining({
          version: expect.any(String),
        }),
      );
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        "Server URL configured",
        expect.objectContaining({
          url: "http://localhost:3000",
        }),
      );
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        "Unix socket configured",
        expect.objectContaining({
          unixSocketPath: runtime.unixSocketPath,
        }),
      );
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        "✅ Daemon started successfully, waiting for messages...",
      );
    });

    it("should log MCP config path if provided", async () => {
      const runtimeWithMcp = setupRuntime();

      const daemonWithMcp = new TerragonDaemon({
        runtime: runtimeWithMcp,
        mcpConfigPath: "/path/to/mcp-config.json",
        messageHandleDelay: 5,
        messageFlushDelay: 10,
      });

      const mcpLoggerSpy = vi.spyOn(runtimeWithMcp.logger, "info");

      await daemonWithMcp.start();

      expect(mcpLoggerSpy).toHaveBeenCalledWith(
        "MCP config path configured",
        expect.objectContaining({
          mcpConfigPath: "/path/to/mcp-config.json",
        }),
      );

      await runtimeWithMcp.teardown();
    });
  });

  describe("message handling logging", () => {
    it("should log when receiving unix socket messages", async () => {
      await daemon.start();

      await writeToUnixSocket({
        unixSocketPath: runtime.unixSocketPath,
        dataStr: JSON.stringify(TEST_INPUT_MESSAGE),
      });
      await sleepUntil(() => spawnCommandLineMock.mock.calls.length === 1);

      expect(loggerInfoSpy).toHaveBeenCalledWith(
        "Received unix socket message",
        expect.objectContaining({
          message: expect.stringContaining("TEST_THREAD_ID_STRING"),
        }),
      );
    });

    it("should log error when receiving invalid message", async () => {
      await daemon.start();

      try {
        await writeToUnixSocket({
          unixSocketPath: runtime.unixSocketPath,
          dataStr: "invalid json {{{",
        });
      } catch {
        // Expected to throw
      }

      await sleep(50);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        "Failed to parse unix socket message",
        expect.objectContaining({
          error: expect.any(Object),
        }),
      );
    });

    it("should log when spawning an agent process", async () => {
      await daemon.start();

      await writeToUnixSocket({
        unixSocketPath: runtime.unixSocketPath,
        dataStr: JSON.stringify(TEST_INPUT_MESSAGE),
      });
      await sleepUntil(() => spawnCommandLineMock.mock.calls.length === 1);

      // Should log the spawning of the agent process
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        "Spawning agent process",
        expect.objectContaining({
          agentName: "Claude",
          command: expect.stringContaining("claude"),
        }),
      );

      // Should log successful spawn
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        "Spawned agent process",
        expect.objectContaining({
          agentName: "Claude",
          processId: expect.any(Number),
        }),
      );
    });
  });

  describe("process lifecycle logging", () => {
    it("should log when spawning a process", async () => {
      await daemon.start();

      await writeToUnixSocket({
        unixSocketPath: runtime.unixSocketPath,
        dataStr: JSON.stringify(TEST_INPUT_MESSAGE),
      });
      await sleepUntil(() => spawnCommandLineMock.mock.calls.length === 1);

      expect(loggerInfoSpy).toHaveBeenCalledWith(
        "Spawning agent process",
        expect.any(Object),
      );
    });

    it("should log when stopping a process", async () => {
      await daemon.start();

      // Start a process
      await writeToUnixSocket({
        unixSocketPath: runtime.unixSocketPath,
        dataStr: JSON.stringify(TEST_INPUT_MESSAGE),
      });
      await sleepUntil(() => spawnCommandLineMock.mock.calls.length === 1);

      // Clear logs to only capture stop-related logs
      loggerInfoSpy.mockClear();

      // Send stop message
      await writeToUnixSocket({
        unixSocketPath: runtime.unixSocketPath,
        dataStr: JSON.stringify({
          type: "stop",
          threadId: "TEST_THREAD_ID_STRING",
          threadChatId: "TEST_THREAD_CHAT_ID_STRING",
          token: "TEST_TOKEN_STRING",
        }),
      });

      await sleep(50);

      // Should log stop handling
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        "Stop message received, killing specific process...",
        expect.objectContaining({
          threadChatId: "TEST_THREAD_CHAT_ID_STRING",
        }),
      );
    });
  });

  describe("heartbeat logging", () => {
    it("should log heartbeat at configured intervals", async () => {
      // Create daemon with very short heartbeat interval
      const shortHeartbeatRuntime = setupRuntime();
      const shortHeartbeatLoggerSpy = vi.spyOn(
        shortHeartbeatRuntime.logger,
        "info",
      );

      const shortHeartbeatDaemon = new TerragonDaemon({
        runtime: shortHeartbeatRuntime,
        uptimeReportingInterval: 100, // 100ms heartbeat
        messageHandleDelay: 5,
        messageFlushDelay: 10,
      });

      await shortHeartbeatDaemon.start();

      // Wait for at least 2 heartbeats
      await sleep(250);

      const heartbeatCalls = shortHeartbeatLoggerSpy.mock.calls.filter(
        (call) => call[0] === "Daemon Heartbeat",
      );
      expect(heartbeatCalls.length).toBeGreaterThanOrEqual(2);
      expect(heartbeatCalls[0]![1]).toMatchObject({
        uptime: expect.stringMatching(/\d+s/),
      });

      await shortHeartbeatRuntime.teardown();
    });
  });

  describe("feature flags logging", () => {
    it("should log when loading feature flags from environment", async () => {
      const originalEnv = process.env.TERRAGON_FEATURE_FLAGS;
      process.env.TERRAGON_FEATURE_FLAGS = JSON.stringify({
        testFlag: true,
        anotherFlag: "value",
      });

      const ffRuntime = setupRuntime();
      const ffLoggerSpy = vi.spyOn(ffRuntime.logger, "info");

      new TerragonDaemon({
        runtime: ffRuntime,
        messageHandleDelay: 5,
        messageFlushDelay: 10,
      });

      expect(ffLoggerSpy).toHaveBeenCalledWith(
        "Feature flags loaded from environment",
        expect.objectContaining({
          featureFlags: { testFlag: true, anotherFlag: "value" },
        }),
      );

      // Restore original env
      if (originalEnv === undefined) {
        delete process.env.TERRAGON_FEATURE_FLAGS;
      } else {
        process.env.TERRAGON_FEATURE_FLAGS = originalEnv;
      }

      await ffRuntime.teardown();
    });

    it("should log error when feature flags are invalid JSON", async () => {
      const originalEnv = process.env.TERRAGON_FEATURE_FLAGS;
      process.env.TERRAGON_FEATURE_FLAGS = "invalid json {{{";

      const ffRuntime = setupRuntime();
      const ffLoggerErrorSpy = vi.spyOn(ffRuntime.logger, "error");

      new TerragonDaemon({
        runtime: ffRuntime,
        messageHandleDelay: 5,
        messageFlushDelay: 10,
      });

      expect(ffLoggerErrorSpy).toHaveBeenCalledWith(
        "Failed to parse feature flags from environment",
        expect.objectContaining({
          error: expect.any(Object),
          envFeatureFlags: "invalid json {{{",
        }),
      );

      // Restore original env
      if (originalEnv === undefined) {
        delete process.env.TERRAGON_FEATURE_FLAGS;
      } else {
        process.env.TERRAGON_FEATURE_FLAGS = originalEnv;
      }

      await ffRuntime.teardown();
    });
  });

  describe("API communication logging", () => {
    it("should log when sending messages to API", async () => {
      await daemon.start();

      await writeToUnixSocket({
        unixSocketPath: runtime.unixSocketPath,
        dataStr: JSON.stringify(TEST_INPUT_MESSAGE),
      });
      await sleepUntil(() => spawnCommandLineMock.mock.calls.length === 1);

      // Simulate Claude output
      const onStdoutLine = spawnCommandLineMock.mock.calls[0]![1].onStdoutLine;
      onStdoutLine?.(
        JSON.stringify({
          role: "assistant",
          content: "Test response",
        }),
      );

      await sleep(50);

      expect(serverPostMock).toHaveBeenCalled();
    });

    it("should log error when API call fails", async () => {
      serverPostMock.mockRejectedValue(new Error("Network error"));

      await daemon.start();

      await writeToUnixSocket({
        unixSocketPath: runtime.unixSocketPath,
        dataStr: JSON.stringify(TEST_INPUT_MESSAGE),
      });
      await sleepUntil(() => spawnCommandLineMock.mock.calls.length === 1);

      // Simulate Claude output
      const onStdoutLine = spawnCommandLineMock.mock.calls[0]![1].onStdoutLine;
      onStdoutLine?.(
        JSON.stringify({
          role: "assistant",
          content: "Test response",
        }),
      );

      // Wait for API call
      await sleep(100);

      // Should have logged the error
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        "Failed to send messages to API",
        expect.objectContaining({
          error: expect.any(Object),
          messageCount: expect.any(Number),
        }),
      );
    });
  });

  describe("output format verification", () => {
    it("should use text format for logging", async () => {
      const unixSocketPath = `/tmp/terragon-daemon-text-${nanoid()}.sock`;
      const textRuntime = new DaemonRuntime({
        url: "http://localhost:3000",
        unixSocketPath,
        outputFormat: "text",
      });
      vi.spyOn(textRuntime, "exitProcess").mockImplementation(() => {});
      vi.spyOn(textRuntime, "killChildProcessGroup").mockImplementation(
        () => {},
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const textDaemon = new TerragonDaemon({
        runtime: textRuntime,
        messageHandleDelay: 5,
        messageFlushDelay: 10,
      });

      await textDaemon.start();

      // Text format should output plain strings, not JSON
      const startupCalls = consoleSpy.mock.calls.filter((call) =>
        call[0]?.includes("Starting Terragon Daemon"),
      );
      expect(startupCalls.length).toBeGreaterThan(0);
      expect(startupCalls[0]![0]).toContain("🚀 Starting Terragon Daemon");
      // Text format should NOT be valid JSON
      expect(() => JSON.parse(startupCalls[0]![0])).toThrow();

      consoleSpy.mockRestore();
      await textRuntime.teardown();
    });

    it("should use JSON format for logging", async () => {
      const unixSocketPath = `/tmp/terragon-daemon-json-${nanoid()}.sock`;
      const jsonRuntime = new DaemonRuntime({
        url: "http://localhost:3000",
        unixSocketPath,
        outputFormat: "json",
      });
      vi.spyOn(jsonRuntime, "exitProcess").mockImplementation(() => {});
      vi.spyOn(jsonRuntime, "killChildProcessGroup").mockImplementation(
        () => {},
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const jsonDaemon = new TerragonDaemon({
        runtime: jsonRuntime,
        messageHandleDelay: 5,
        messageFlushDelay: 10,
      });

      await jsonDaemon.start();

      // JSON format should output valid JSON
      const startupCalls = consoleSpy.mock.calls.filter((call) =>
        call[0]?.includes("Starting Terragon Daemon"),
      );
      expect(startupCalls.length).toBeGreaterThan(0);
      expect(() => JSON.parse(startupCalls[0]![0])).not.toThrow();

      const parsed = JSON.parse(startupCalls[0]![0]);
      expect(parsed).toMatchObject({
        level: "info",
        message: "🚀 Starting Terragon Daemon...",
        timestamp: expect.any(String),
      });

      consoleSpy.mockRestore();
      await jsonRuntime.teardown();
    });
  });
});
