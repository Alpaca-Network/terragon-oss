import { describe, it, expect, beforeEach } from "vitest";
import { ISandboxSession } from "../types";
import {
  hasSubmodules,
  initializeSubmodules,
  updateSubmodules,
  getSubmoduleStatus,
  commitSubmoduleChanges,
  pushSubmodules,
} from "./git-submodules";

// Mock sandbox session for testing
function createMockSession(
  commandResults: Record<string, string | Error> = {},
): ISandboxSession {
  return {
    sandboxId: "test-sandbox",
    repoDir: "/repo",
    runCommand: async (cmd: string) => {
      // Match command patterns
      for (const [pattern, result] of Object.entries(commandResults)) {
        if (cmd.includes(pattern)) {
          if (result instanceof Error) {
            throw result;
          }
          return result;
        }
      }
      return "";
    },
    writeTextFile: async () => {},
    readTextFile: async () => "",
  } as ISandboxSession;
}

describe("git-submodules", () => {
  describe("hasSubmodules", () => {
    it("should return true when .gitmodules exists", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
      });

      const result = await hasSubmodules({ session });
      expect(result).toBe(true);
    });

    it("should return false when .gitmodules does not exist", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "",
      });

      const result = await hasSubmodules({ session });
      expect(result).toBe(false);
    });

    it("should return false on command error", async () => {
      const session = createMockSession({
        "test -f .gitmodules": new Error("Command failed"),
      });

      const result = await hasSubmodules({ session });
      expect(result).toBe(false);
    });
  });

  describe("initializeSubmodules", () => {
    it("should initialize submodules when .gitmodules exists", async () => {
      let initCalled = false;
      let updateCalled = false;

      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule init": (() => {
          initCalled = true;
          return "";
        })(),
        "git submodule update": (() => {
          updateCalled = true;
          return "";
        })(),
      });

      const result = await initializeSubmodules({ session });

      expect(result).toBe(true);
      expect(initCalled).toBe(true);
      expect(updateCalled).toBe(true);
    });

    it("should return false when no submodules exist", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "",
      });

      const result = await initializeSubmodules({ session });
      expect(result).toBe(false);
    });

    it("should return false and warn when initialization fails", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule init": new Error("Init failed"),
      });

      const result = await initializeSubmodules({ session });
      expect(result).toBe(false);
    });
  });

  describe("updateSubmodules", () => {
    it("should update submodules when .gitmodules exists", async () => {
      let syncCalled = false;
      let updateCalled = false;

      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule sync": (() => {
          syncCalled = true;
          return "";
        })(),
        "git submodule update": (() => {
          updateCalled = true;
          return "";
        })(),
      });

      const result = await updateSubmodules({ session });

      expect(result).toBe(true);
      expect(syncCalled).toBe(true);
      expect(updateCalled).toBe(true);
    });

    it("should return false when no submodules exist", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "",
      });

      const result = await updateSubmodules({ session });
      expect(result).toBe(false);
    });

    it("should return false and warn when update fails", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule sync": "",
        "git submodule update": new Error("Update failed"),
      });

      const result = await updateSubmodules({ session });
      expect(result).toBe(false);
    });
  });

  describe("getSubmoduleStatus", () => {
    it("should return no changes when submodules are up to date", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule status":
          " 1234567890abcdef lib/foo (v1.0.0)\n 234567890abcdef1 lib/bar (v2.0.0)",
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(false);
      expect(result.changedSubmodules).toEqual([]);
    });

    it("should detect changed submodules with + prefix", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule status":
          "+1234567890abcdef lib/foo (v1.0.1)\n 234567890abcdef1 lib/bar (v2.0.0)",
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(true);
      expect(result.changedSubmodules).toEqual(["lib/foo"]);
    });

    it("should detect uninitialized submodules with - prefix", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule status": "-1234567890abcdef lib/foo\n lib/bar",
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(true);
      expect(result.changedSubmodules).toEqual(["lib/foo"]);
    });

    it("should detect conflicted submodules with U prefix", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule status": "U1234567890abcdef lib/foo (v1.0.0)",
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(true);
      expect(result.changedSubmodules).toEqual(["lib/foo"]);
    });

    it("should return no changes when no submodules exist", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "",
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(false);
      expect(result.changedSubmodules).toEqual([]);
    });
  });

  describe("commitSubmoduleChanges", () => {
    it("should commit changes in submodules with modifications", async () => {
      const committedSubmodules: string[] = [];

      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        repoDir: "/repo",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          if (cmd.includes("test -f .gitmodules")) {
            return "yes";
          }
          if (cmd.includes("git submodule foreach")) {
            return "lib/foo\nlib/bar";
          }
          if (cmd.includes("git status --porcelain")) {
            // lib/foo has changes, lib/bar doesn't
            if (options?.cwd?.includes("lib/foo")) {
              return "M file.txt";
            }
            return "";
          }
          if (cmd.includes("git add -A")) {
            return "";
          }
          if (cmd.includes("git commit")) {
            if (options?.cwd?.includes("lib/foo")) {
              committedSubmodules.push("lib/foo");
            }
            return "";
          }
          return "";
        },
        writeTextFile: async () => {},
        readTextFile: async () => "",
      } as ISandboxSession;

      const result = await commitSubmoduleChanges({
        session,
        commitMessage: "Test commit",
      });

      expect(result).toEqual(["lib/foo"]);
      expect(committedSubmodules).toContain("lib/foo");
    });

    it("should return empty array when no submodules exist", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "",
      });

      const result = await commitSubmoduleChanges({
        session,
        commitMessage: "Test commit",
      });

      expect(result).toEqual([]);
    });

    it("should skip submodules without changes", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule foreach": "lib/foo",
        "git status --porcelain": "",
      });

      const result = await commitSubmoduleChanges({
        session,
        commitMessage: "Test commit",
      });

      expect(result).toEqual([]);
    });
  });

  describe("pushSubmodules", () => {
    it("should push specified submodules", async () => {
      const pushedSubmodules: string[] = [];

      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        repoDir: "/repo",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          if (cmd.includes("git push")) {
            if (options?.cwd?.includes("lib/foo")) {
              pushedSubmodules.push("lib/foo");
            }
            if (options?.cwd?.includes("lib/bar")) {
              pushedSubmodules.push("lib/bar");
            }
          }
          return "";
        },
        writeTextFile: async () => {},
        readTextFile: async () => "",
      } as ISandboxSession;

      const result = await pushSubmodules({
        session,
        submodulePaths: ["lib/foo", "lib/bar"],
      });

      expect(result).toEqual(["lib/foo", "lib/bar"]);
      expect(pushedSubmodules).toEqual(["lib/foo", "lib/bar"]);
    });

    it("should return empty array when no submodules provided", async () => {
      const session = createMockSession({});

      const result = await pushSubmodules({
        session,
        submodulePaths: [],
      });

      expect(result).toEqual([]);
    });

    it("should handle push failures gracefully", async () => {
      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        repoDir: "/repo",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          if (cmd.includes("git push")) {
            if (options?.cwd?.includes("lib/foo")) {
              throw new Error("Push failed");
            }
          }
          return "";
        },
        writeTextFile: async () => {},
        readTextFile: async () => "",
      } as ISandboxSession;

      const result = await pushSubmodules({
        session,
        submodulePaths: ["lib/foo", "lib/bar"],
      });

      // lib/foo failed, lib/bar succeeded
      expect(result).toEqual(["lib/bar"]);
    });
  });
});
