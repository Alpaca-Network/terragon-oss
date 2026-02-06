import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger, LogEntry } from "./logger";

describe("Logger", () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("text format", () => {
    it("should output plain text message without data", () => {
      const logger = new Logger("text");
      logger.info("Hello, world!");

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledWith("Hello, world!");
    });

    it("should output plain text message with data as key-value pairs", () => {
      const logger = new Logger("text");
      logger.info("Starting process", { pid: 1234, name: "daemon" });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "Starting process pid: 1234 name: daemon",
      );
    });

    it("should handle empty data object", () => {
      const logger = new Logger("text");
      logger.info("Message", {});

      expect(consoleSpy.log).toHaveBeenCalledWith("Message");
    });

    it("should handle complex data values", () => {
      const logger = new Logger("text");
      logger.info("Complex data", {
        nested: { a: 1 },
        array: [1, 2, 3],
        boolean: true,
        nullValue: null,
      });

      const loggedMessage = consoleSpy.log.mock.calls[0]![0];
      expect(loggedMessage).toContain("Complex data");
      expect(loggedMessage).toContain("nested:");
      expect(loggedMessage).toContain("array:");
    });

    it("should use correct log levels for text format", () => {
      const logger = new Logger("text");

      logger.info("info message");
      expect(consoleSpy.log).toHaveBeenLastCalledWith("info message");

      logger.error("error message");
      expect(consoleSpy.error).toHaveBeenLastCalledWith("error message");

      logger.warn("warn message");
      expect(consoleSpy.warn).toHaveBeenLastCalledWith("warn message");

      logger.debug("debug message");
      expect(consoleSpy.log).toHaveBeenLastCalledWith("debug message");
    });
  });

  describe("json format", () => {
    it("should output JSON with timestamp, level, and message", () => {
      const logger = new Logger("json");
      const beforeTime = new Date().toISOString();
      logger.info("Hello, JSON!");
      const afterTime = new Date().toISOString();

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const loggedJson = consoleSpy.log.mock.calls[0]![0] as string;
      const parsed: LogEntry = JSON.parse(loggedJson);

      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Hello, JSON!");
      expect(parsed.timestamp).toBeDefined();
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
      expect(parsed.timestamp >= beforeTime).toBe(true);
      expect(parsed.timestamp <= afterTime).toBe(true);
      expect(parsed.data).toBeUndefined();
    });

    it("should include data in JSON output", () => {
      const logger = new Logger("json");
      logger.info("With data", { userId: "123", action: "login" });

      const loggedJson = consoleSpy.log.mock.calls[0]![0] as string;
      const parsed: LogEntry = JSON.parse(loggedJson);

      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("With data");
      expect(parsed.data).toEqual({ userId: "123", action: "login" });
    });

    it("should not include data field when data is undefined", () => {
      const logger = new Logger("json");
      logger.info("No data");

      const loggedJson = consoleSpy.log.mock.calls[0]![0] as string;
      const parsed = JSON.parse(loggedJson) as LogEntry;

      expect(Object.keys(parsed)).toEqual(["timestamp", "level", "message"]);
      expect(parsed.data).toBeUndefined();
    });

    it("should handle all log levels correctly", () => {
      const logger = new Logger("json");

      logger.info("info");
      let parsed = JSON.parse(
        consoleSpy.log.mock.calls[0]![0] as string,
      ) as LogEntry;
      expect(parsed.level).toBe("info");

      logger.error("error");
      parsed = JSON.parse(
        consoleSpy.error.mock.calls[0]![0] as string,
      ) as LogEntry;
      expect(parsed.level).toBe("error");

      logger.warn("warn");
      parsed = JSON.parse(
        consoleSpy.warn.mock.calls[0]![0] as string,
      ) as LogEntry;
      expect(parsed.level).toBe("warn");

      logger.debug("debug");
      parsed = JSON.parse(
        consoleSpy.log.mock.calls[1]![0] as string,
      ) as LogEntry;
      expect(parsed.level).toBe("debug");
    });

    it("should produce valid JSON for complex nested data", () => {
      const logger = new Logger("json");
      const complexData = {
        nested: { deep: { value: 123 } },
        array: [1, "two", { three: 3 }],
        special: 'string with "quotes" and \nnewlines',
      };

      logger.info("Complex", complexData);

      const loggedJson = consoleSpy.log.mock.calls[0]![0] as string;
      expect(() => JSON.parse(loggedJson)).not.toThrow();
      const parsed = JSON.parse(loggedJson) as LogEntry;
      expect(parsed.data).toEqual(complexData);
    });

    it("should handle special characters in messages", () => {
      const logger = new Logger("json");
      logger.info('Message with "quotes" and\nnewlines');

      const loggedJson = consoleSpy.log.mock.calls[0]![0] as string;
      expect(() => JSON.parse(loggedJson)).not.toThrow();
      const parsed = JSON.parse(loggedJson) as LogEntry;
      expect(parsed.message).toBe('Message with "quotes" and\nnewlines');
    });
  });

  describe("default format", () => {
    it("should default to text format when no format specified", () => {
      const logger = new Logger();
      logger.info("Default format");

      expect(consoleSpy.log).toHaveBeenCalledWith("Default format");
    });
  });

  describe("log method", () => {
    it("should route to correct log method based on level", () => {
      const logger = new Logger("text");

      logger.log("info", "info via log");
      expect(consoleSpy.log).toHaveBeenLastCalledWith("info via log");

      logger.log("error", "error via log");
      expect(consoleSpy.error).toHaveBeenLastCalledWith("error via log");

      logger.log("warn", "warn via log");
      expect(consoleSpy.warn).toHaveBeenLastCalledWith("warn via log");

      logger.log("debug", "debug via log");
      expect(consoleSpy.log).toHaveBeenLastCalledWith("debug via log");
    });

    it("should pass data through log method", () => {
      const logger = new Logger("json");
      logger.log("info", "message", { key: "value" });

      const parsed = JSON.parse(
        consoleSpy.log.mock.calls[0]![0] as string,
      ) as LogEntry;
      expect(parsed.data).toEqual({ key: "value" });
    });
  });

  describe("error object handling", () => {
    it("should handle Error objects in data", () => {
      const logger = new Logger("json");
      const error = new Error("Test error");

      logger.error("An error occurred", { error });

      const loggedJson = consoleSpy.error.mock.calls[0]![0] as string;
      const parsed = JSON.parse(loggedJson) as LogEntry;
      expect(parsed.data?.error).toBeDefined();
    });

    it("should handle undefined and null in data", () => {
      const logger = new Logger("json");

      logger.info("With nulls", {
        undefinedVal: undefined,
        nullVal: null,
      });

      const loggedJson = consoleSpy.log.mock.calls[0]![0] as string;
      const parsed = JSON.parse(loggedJson) as LogEntry;
      expect((parsed.data as { nullVal: null })?.nullVal).toBeNull();
      // undefined values are excluded from JSON.stringify
    });
  });

  describe("timestamp format", () => {
    it("should use ISO 8601 timestamp format", () => {
      const logger = new Logger("json");
      logger.info("Timestamp test");

      const loggedJson = consoleSpy.log.mock.calls[0]![0] as string;
      const parsed = JSON.parse(loggedJson) as LogEntry;

      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(parsed.timestamp).toMatch(isoRegex);
    });
  });

  describe("concurrent logging", () => {
    it("should handle rapid successive log calls", () => {
      const logger = new Logger("json");

      for (let i = 0; i < 100; i++) {
        logger.info(`Message ${i}`, { index: i });
      }

      expect(consoleSpy.log).toHaveBeenCalledTimes(100);

      // Verify all messages are valid JSON
      for (let i = 0; i < 100; i++) {
        const loggedJson = consoleSpy.log.mock.calls[i]![0] as string;
        expect(() => JSON.parse(loggedJson)).not.toThrow();
        const parsed = JSON.parse(loggedJson) as LogEntry;
        expect(parsed.message).toBe(`Message ${i}`);
        expect((parsed.data as { index: number })?.index).toBe(i);
      }
    });

    it("should maintain correct timestamp ordering", () => {
      const logger = new Logger("json");

      logger.info("First");
      logger.info("Second");
      logger.info("Third");

      const timestamps = consoleSpy.log.mock.calls.map((call) => {
        const parsed = JSON.parse(call[0] as string) as LogEntry;
        return new Date(parsed.timestamp).getTime();
      });

      // Timestamps should be in non-decreasing order
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]!);
      }
    });
  });

  describe("format switching", () => {
    it("should use different formats for different logger instances", () => {
      const textLogger = new Logger("text");
      const jsonLogger = new Logger("json");

      textLogger.info("Text message", { key: "value" });
      jsonLogger.info("JSON message", { key: "value" });

      expect(consoleSpy.log).toHaveBeenNthCalledWith(
        1,
        "Text message key: value",
      );

      const jsonCall = consoleSpy.log.mock.calls[1]![0] as string;
      expect(() => JSON.parse(jsonCall)).not.toThrow();
      const parsed = JSON.parse(jsonCall) as LogEntry;
      expect(parsed.message).toBe("JSON message");
    });
  });
});
