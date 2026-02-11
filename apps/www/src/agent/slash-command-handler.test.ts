import { describe, it, expect, vi } from "vitest";
import {
  extractSlashCommandName,
  getSlashCommandOrNull,
} from "./slash-command-handler";
import type { DBUserMessage } from "@terragon/shared";

// Mock dependencies that handleSlashCommand would use
vi.mock("@/lib/posthog-server", () => ({
  getPostHogServer: () => ({
    capture: vi.fn(),
  }),
}));

// Shared helper to create user messages for testing
const createMessage = (text: string): DBUserMessage => ({
  type: "user",
  model: null,
  parts: [{ type: "text", text }],
});

describe("extractSlashCommandName", () => {
  it("should extract command name from simple slash command", () => {
    expect(extractSlashCommandName("/clear")).toBe("clear");
    expect(extractSlashCommandName("/compact")).toBe("compact");
    expect(extractSlashCommandName("/init")).toBe("init");
    expect(extractSlashCommandName("/pr-comments")).toBe("pr-comments");
    expect(extractSlashCommandName("/review")).toBe("review");
  });

  it("should extract command name with arguments", () => {
    expect(extractSlashCommandName("/init my-project")).toBe("init");
    expect(extractSlashCommandName("/review src/main.ts")).toBe("review");
    expect(extractSlashCommandName("/skill-name arg1 arg2")).toBe("skill-name");
  });

  it("should handle command names with hyphens and underscores", () => {
    expect(extractSlashCommandName("/my-command")).toBe("my-command");
    expect(extractSlashCommandName("/my_command")).toBe("my_command");
    expect(extractSlashCommandName("/my-multi-word-command")).toBe(
      "my-multi-word-command",
    );
  });

  it("should return null for non-slash command messages", () => {
    expect(extractSlashCommandName("hello world")).toBe(null);
    expect(extractSlashCommandName("just some text")).toBe(null);
    expect(extractSlashCommandName("")).toBe(null);
  });

  it("should extract first command from multiple commands in message", () => {
    // When user types "/inbox and /code", we should detect "/inbox"
    expect(extractSlashCommandName("/inbox and /code")).toBe("inbox");
    expect(extractSlashCommandName("/foo /bar /baz")).toBe("foo");
  });

  it("should handle whitespace correctly", () => {
    expect(extractSlashCommandName("  /clear  ")).toBe("clear");
    expect(extractSlashCommandName("\t/init\n")).toBe("init");
  });

  it("should not match slash in the middle of text", () => {
    expect(extractSlashCommandName("hello /command")).toBe(null);
    expect(extractSlashCommandName("use /path/to/file")).toBe(null);
  });
});

describe("getSlashCommandOrNull", () => {
  it("should return /clear for exact /clear command", () => {
    expect(getSlashCommandOrNull(createMessage("/clear"))).toBe("/clear");
  });

  it("should return /compact for exact /compact command", () => {
    expect(getSlashCommandOrNull(createMessage("/compact"))).toBe("/compact");
  });

  it("should return null for other commands (they need skill/agent handling)", () => {
    expect(getSlashCommandOrNull(createMessage("/init"))).toBe(null);
    expect(getSlashCommandOrNull(createMessage("/review"))).toBe(null);
    expect(getSlashCommandOrNull(createMessage("/inbox"))).toBe(null);
    expect(getSlashCommandOrNull(createMessage("/unknown-command"))).toBe(null);
  });

  it("should return null for non-command messages", () => {
    expect(getSlashCommandOrNull(createMessage("hello"))).toBe(null);
    expect(getSlashCommandOrNull(createMessage("just text"))).toBe(null);
  });

  it("should handle whitespace in messages", () => {
    expect(getSlashCommandOrNull(createMessage("  /clear  "))).toBe("/clear");
    expect(getSlashCommandOrNull(createMessage("\n/compact\n"))).toBe(
      "/compact",
    );
  });

  it("should return null when command has extra text", () => {
    // /clear and /compact only match exactly
    expect(getSlashCommandOrNull(createMessage("/clear now"))).toBe(null);
    expect(getSlashCommandOrNull(createMessage("/compact please"))).toBe(null);
  });
});

describe("unknown slash command handling", () => {
  it("should detect unknown slash commands but treat them as keywords", () => {
    // Unknown slash commands like "/audit" should be detected for logging
    // but should pass through to the agent as regular messages
    expect(extractSlashCommandName("/audit")).toBe("audit");
    expect(extractSlashCommandName("/audit the code")).toBe("audit");
    expect(extractSlashCommandName("/inbox")).toBe("inbox");

    // These are detected as commands but are NOT server-handled commands
    // so they would pass through to the agent
    expect(getSlashCommandOrNull(createMessage("/audit"))).toBe(null);
    expect(getSlashCommandOrNull(createMessage("/inbox"))).toBe(null);
  });
});
