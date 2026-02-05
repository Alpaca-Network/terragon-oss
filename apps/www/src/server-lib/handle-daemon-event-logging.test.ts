import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createTestThread,
  createTestUser,
} from "@terragon/shared/model/test-helpers";
import { db } from "@/lib/db";
import * as schema from "@terragon/shared/db/schema";
import { eq } from "drizzle-orm";
import {
  mockLoggedInUser,
  mockWaitUntil,
  waitUntilResolved,
} from "@/test-helpers/mock-next";
import { saveClaudeTokensForTest } from "@/test-helpers/agent";
import { handleDaemonEvent } from "./handle-daemon-event";
import { ClaudeMessage } from "@terragon/daemon/shared";

describe("handle-daemon-event logging", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Spy on console methods to verify logging
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Ensure all threads are complete so we don't mess other tests
    await db.update(schema.thread).set({
      status: "complete",
      reattemptQueueAt: null,
    });
    await db.update(schema.threadChat).set({
      status: "complete",
      reattemptQueueAt: null,
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("daemon event logging", () => {
    it("should log daemon event with threadId, threadChatId and timezone", async () => {
      const testUserAndAccount = await createTestUser({ db });
      const user = testUserAndAccount.user;
      const session = testUserAndAccount.session;
      await saveClaudeTokensForTest({ userId: user.id });

      await mockWaitUntil();
      await mockLoggedInUser(session);

      const { threadId, threadChatId } = await createTestThread({
        db,
        userId: user.id,
        overrides: {
          // Set sandbox ID to avoid sandbox operations
          codesandboxId: "test-sandbox-id",
          sandboxProvider: "docker",
        },
      });

      // Set up the thread chat to be in working status
      await db
        .update(schema.threadChat)
        .set({ status: "working" })
        .where(eq(schema.threadChat.id, threadChatId));

      const messages: ClaudeMessage[] = [
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello, world!" }],
          },
          parent_tool_use_id: null,
          session_id: "test-session-id",
        },
      ];

      await handleDaemonEvent({
        threadId,
        threadChatId,
        userId: user.id,
        timezone: "America/New_York",
        contextUsage: null,
        messages,
      });
      await waitUntilResolved();

      // Verify logging includes key identifiers
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Daemon event",
        "threadId",
        threadId,
        "threadChatId",
        threadChatId,
        "timezone",
        "America/New_York",
        "messages",
        expect.any(String),
      );
    });

    it("should log thread chat status", async () => {
      const testUserAndAccount = await createTestUser({ db });
      const user = testUserAndAccount.user;
      const session = testUserAndAccount.session;
      await saveClaudeTokensForTest({ userId: user.id });

      await mockWaitUntil();
      await mockLoggedInUser(session);

      const { threadId, threadChatId } = await createTestThread({
        db,
        userId: user.id,
        overrides: {
          codesandboxId: "test-sandbox-id",
          sandboxProvider: "docker",
        },
      });

      // Set up the thread chat to be in working status
      await db
        .update(schema.threadChat)
        .set({ status: "working" })
        .where(eq(schema.threadChat.id, threadChatId));

      const messages: ClaudeMessage[] = [
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Processing..." }],
          },
          parent_tool_use_id: null,
          session_id: "test-session-id",
        },
      ];

      await handleDaemonEvent({
        threadId,
        threadChatId,
        userId: user.id,
        timezone: "America/New_York",
        contextUsage: null,
        messages,
      });
      await waitUntilResolved();

      // Verify thread chat status is logged (may be "queued" due to state changes)
      const statusLogCall = consoleLogSpy.mock.calls.find(
        (call) => call[0] === "Thread chat status: ",
      );
      expect(statusLogCall).toBeDefined();
      expect(["working", "queued"]).toContain(statusLogCall![1]);
    });

    it("should log message content in JSON format", async () => {
      const testUserAndAccount = await createTestUser({ db });
      const user = testUserAndAccount.user;
      const session = testUserAndAccount.session;
      await saveClaudeTokensForTest({ userId: user.id });

      await mockWaitUntil();
      await mockLoggedInUser(session);

      const { threadId, threadChatId } = await createTestThread({
        db,
        userId: user.id,
        overrides: {
          codesandboxId: "test-sandbox-id",
          sandboxProvider: "docker",
        },
      });

      // Set up the thread chat to be in working status
      await db
        .update(schema.threadChat)
        .set({ status: "working" })
        .where(eq(schema.threadChat.id, threadChatId));

      const messages: ClaudeMessage[] = [
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Test message content" }],
          },
          parent_tool_use_id: null,
          session_id: "test-session-123",
        },
      ];

      await handleDaemonEvent({
        threadId,
        threadChatId,
        userId: user.id,
        timezone: "UTC",
        contextUsage: null,
        messages,
      });
      await waitUntilResolved();

      // Find the logged message string
      const daemonEventCall = consoleLogSpy.mock.calls.find(
        (call) => call[0] === "Daemon event",
      );
      expect(daemonEventCall).toBeDefined();

      // The last argument should be the JSON stringified messages
      const messagesJson = daemonEventCall![daemonEventCall!.length - 1];
      expect(() => JSON.parse(messagesJson)).not.toThrow();

      const parsedMessages = JSON.parse(messagesJson);
      expect(parsedMessages).toEqual(messages);
    });

    it("should log when processing result messages", async () => {
      const testUserAndAccount = await createTestUser({ db });
      const user = testUserAndAccount.user;
      const session = testUserAndAccount.session;
      await saveClaudeTokensForTest({ userId: user.id });

      await mockWaitUntil();
      await mockLoggedInUser(session);

      const { threadId, threadChatId } = await createTestThread({
        db,
        userId: user.id,
        overrides: {
          codesandboxId: "test-sandbox-id",
          sandboxProvider: "docker",
        },
      });

      // Set up the thread chat to be in working status
      await db
        .update(schema.threadChat)
        .set({ status: "working" })
        .where(eq(schema.threadChat.id, threadChatId));

      const resultMessage: ClaudeMessage = {
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 1000,
        duration_api_ms: 500,
        num_turns: 1,
        result: "Task completed",
        session_id: "test-session-id",
        total_cost_usd: 0.01,
        usage: {
          input_tokens: 100,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 50,
          server_tool_use: { web_search_requests: 0 },
          service_tier: "standard",
        },
      };

      await handleDaemonEvent({
        threadId,
        threadChatId,
        userId: user.id,
        timezone: "America/New_York",
        contextUsage: null,
        messages: [resultMessage],
      });
      await waitUntilResolved();

      // Verify daemon event was logged with result message
      const daemonEventCall = consoleLogSpy.mock.calls.find(
        (call) => call[0] === "Daemon event",
      );
      expect(daemonEventCall).toBeDefined();

      const messagesJson = daemonEventCall![daemonEventCall!.length - 1];
      const parsedMessages = JSON.parse(messagesJson);
      expect(parsedMessages[0].type).toBe("result");
    });

    it("should log when processing stop messages", async () => {
      const testUserAndAccount = await createTestUser({ db });
      const user = testUserAndAccount.user;
      const session = testUserAndAccount.session;
      await saveClaudeTokensForTest({ userId: user.id });

      await mockWaitUntil();
      await mockLoggedInUser(session);

      const { threadId, threadChatId } = await createTestThread({
        db,
        userId: user.id,
        overrides: {
          codesandboxId: "test-sandbox-id",
          sandboxProvider: "docker",
        },
      });

      // Set up the thread chat to be in working status
      await db
        .update(schema.threadChat)
        .set({ status: "working" })
        .where(eq(schema.threadChat.id, threadChatId));

      const stopMessage: ClaudeMessage = {
        type: "custom-stop",
        session_id: "test-session-id",
        duration_ms: 1000,
      };

      await handleDaemonEvent({
        threadId,
        threadChatId,
        userId: user.id,
        timezone: "America/New_York",
        contextUsage: null,
        messages: [stopMessage],
      });
      await waitUntilResolved();

      // Verify daemon event was logged with stop message
      const daemonEventCall = consoleLogSpy.mock.calls.find(
        (call) => call[0] === "Daemon event",
      );
      expect(daemonEventCall).toBeDefined();

      const messagesJson = daemonEventCall![daemonEventCall!.length - 1];
      const parsedMessages = JSON.parse(messagesJson);
      expect(parsedMessages[0].type).toBe("custom-stop");
    });

    it("should log when processing error messages", async () => {
      const testUserAndAccount = await createTestUser({ db });
      const user = testUserAndAccount.user;
      const session = testUserAndAccount.session;
      await saveClaudeTokensForTest({ userId: user.id });

      await mockWaitUntil();
      await mockLoggedInUser(session);

      const { threadId, threadChatId } = await createTestThread({
        db,
        userId: user.id,
        overrides: {
          codesandboxId: "test-sandbox-id",
          sandboxProvider: "docker",
        },
      });

      // Set up the thread chat to be in working status
      await db
        .update(schema.threadChat)
        .set({ status: "working" })
        .where(eq(schema.threadChat.id, threadChatId));

      const errorMessage: ClaudeMessage = {
        type: "custom-error",
        session_id: "test-session-id",
        duration_ms: 500,
        error_info: "Test error occurred",
      };

      await handleDaemonEvent({
        threadId,
        threadChatId,
        userId: user.id,
        timezone: "America/New_York",
        contextUsage: null,
        messages: [errorMessage],
      });
      await waitUntilResolved();

      // Verify daemon event was logged with error message
      const daemonEventCall = consoleLogSpy.mock.calls.find(
        (call) => call[0] === "Daemon event",
      );
      expect(daemonEventCall).toBeDefined();

      const messagesJson = daemonEventCall![daemonEventCall!.length - 1];
      const parsedMessages = JSON.parse(messagesJson);
      expect(parsedMessages[0].type).toBe("custom-error");
      expect(parsedMessages[0].error_info).toBe("Test error occurred");
    });

    it("should log with different timezones", async () => {
      const testUserAndAccount = await createTestUser({ db });
      const user = testUserAndAccount.user;
      const session = testUserAndAccount.session;
      await saveClaudeTokensForTest({ userId: user.id });

      await mockWaitUntil();
      await mockLoggedInUser(session);

      const { threadId, threadChatId } = await createTestThread({
        db,
        userId: user.id,
        overrides: {
          codesandboxId: "test-sandbox-id",
          sandboxProvider: "docker",
        },
      });

      // Set up the thread chat to be in working status
      await db
        .update(schema.threadChat)
        .set({ status: "working" })
        .where(eq(schema.threadChat.id, threadChatId));

      const messages: ClaudeMessage[] = [
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: "Testing timezone",
          },
          parent_tool_use_id: null,
          session_id: "test-session-id",
        },
      ];

      // Test with different timezone
      await handleDaemonEvent({
        threadId,
        threadChatId,
        userId: user.id,
        timezone: "Europe/London",
        contextUsage: null,
        messages,
      });
      await waitUntilResolved();

      // Verify logging includes the correct timezone
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Daemon event",
        "threadId",
        threadId,
        "threadChatId",
        threadChatId,
        "timezone",
        "Europe/London",
        "messages",
        expect.any(String),
      );
    });

    it("should log multiple messages in a single event", async () => {
      const testUserAndAccount = await createTestUser({ db });
      const user = testUserAndAccount.user;
      const session = testUserAndAccount.session;
      await saveClaudeTokensForTest({ userId: user.id });

      await mockWaitUntil();
      await mockLoggedInUser(session);

      const { threadId, threadChatId } = await createTestThread({
        db,
        userId: user.id,
        overrides: {
          codesandboxId: "test-sandbox-id",
          sandboxProvider: "docker",
        },
      });

      // Set up the thread chat to be in working status
      await db
        .update(schema.threadChat)
        .set({ status: "working" })
        .where(eq(schema.threadChat.id, threadChatId));

      const messages: ClaudeMessage[] = [
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: "First message",
          },
          parent_tool_use_id: null,
          session_id: "test-session-id",
        },
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: "Second message",
          },
          parent_tool_use_id: null,
          session_id: "test-session-id",
        },
        {
          type: "result",
          subtype: "success",
          is_error: false,
          duration_ms: 1000,
          duration_api_ms: 500,
          num_turns: 2,
          result: "Done",
          session_id: "test-session-id",
          total_cost_usd: 0.01,
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            output_tokens: 50,
            server_tool_use: { web_search_requests: 0 },
            service_tier: "standard",
          },
        },
      ];

      await handleDaemonEvent({
        threadId,
        threadChatId,
        userId: user.id,
        timezone: "America/New_York",
        contextUsage: null,
        messages,
      });
      await waitUntilResolved();

      // Verify all messages are logged
      const daemonEventCall = consoleLogSpy.mock.calls.find(
        (call) => call[0] === "Daemon event",
      );
      expect(daemonEventCall).toBeDefined();

      const messagesJson = daemonEventCall![daemonEventCall!.length - 1];
      const parsedMessages = JSON.parse(messagesJson);
      expect(parsedMessages).toHaveLength(3);
      expect(parsedMessages[0].type).toBe("assistant");
      expect(parsedMessages[1].type).toBe("assistant");
      expect(parsedMessages[2].type).toBe("result");
    });
  });
});
