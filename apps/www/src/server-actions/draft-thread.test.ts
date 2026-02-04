import { describe, it, vi, beforeEach, expect } from "vitest";
import { updateDraftThread } from "./draft-thread";
import { db } from "@/lib/db";
import {
  createTestUser,
  createTestThread,
} from "@terragon/shared/model/test-helpers";
import { mockLoggedInUser, mockLoggedOutUser } from "@/test-helpers/mock-next";
import { User, Session, DBUserMessage } from "@terragon/shared";
import { unwrapResult } from "@/lib/server-actions";
import { getThread } from "@terragon/shared/model/threads";

const updateDraft = async (args: {
  threadId: string;
  updates: Parameters<typeof updateDraftThread>[0]["updates"];
}) => {
  return unwrapResult(await updateDraftThread(args));
};

const draftMessage: DBUserMessage = {
  type: "user",
  model: "sonnet",
  parts: [{ type: "text", text: "Test draft message" }],
};

describe("draft-thread", () => {
  let user: User;
  let session: Session;
  let otherUserSession: Session;
  let threadId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    const [testUserResult, otherUserResult] = await Promise.all([
      createTestUser({ db }),
      createTestUser({ db }),
    ]);
    user = testUserResult.user;
    session = testUserResult.session;
    otherUserSession = otherUserResult.session;

    // Create a draft thread (a thread with draftMessage)
    const createTestThreadResult = await createTestThread({
      db,
      userId: user.id,
      overrides: {
        draftMessage,
      },
    });
    threadId = createTestThreadResult.threadId;
  });

  describe("updateDraftThread", () => {
    it("should throw error when user is not authenticated", async () => {
      await mockLoggedOutUser();
      await expect(
        updateDraft({ threadId, updates: { skipSetup: true } }),
      ).rejects.toThrow("Unauthorized");
    });

    it("should update skipSetup for draft thread", async () => {
      await mockLoggedInUser(session);
      await updateDraft({ threadId, updates: { skipSetup: true } });

      const thread = await getThread({ db, userId: user.id, threadId });
      expect(thread).toBeDefined();
      expect(thread!.skipSetup).toBe(true);
    });

    it("should update disableGitCheckpointing for draft thread", async () => {
      await mockLoggedInUser(session);
      await updateDraft({
        threadId,
        updates: { disableGitCheckpointing: true },
      });

      const thread = await getThread({ db, userId: user.id, threadId });
      expect(thread).toBeDefined();
      expect(thread!.disableGitCheckpointing).toBe(true);
    });

    it("should update autoFixFeedback for draft thread", async () => {
      await mockLoggedInUser(session);
      await updateDraft({ threadId, updates: { autoFixFeedback: true } });

      const thread = await getThread({ db, userId: user.id, threadId });
      expect(thread).toBeDefined();
      expect(thread!.autoFixFeedback).toBe(true);
    });

    it("should update autoMergePR for draft thread", async () => {
      await mockLoggedInUser(session);
      await updateDraft({ threadId, updates: { autoMergePR: true } });

      const thread = await getThread({ db, userId: user.id, threadId });
      expect(thread).toBeDefined();
      expect(thread!.autoMergePR).toBe(true);
    });

    it("should update multiple fields at once", async () => {
      await mockLoggedInUser(session);
      await updateDraft({
        threadId,
        updates: {
          autoFixFeedback: true,
          autoMergePR: true,
          skipSetup: true,
        },
      });

      const thread = await getThread({ db, userId: user.id, threadId });
      expect(thread).toBeDefined();
      expect(thread!.autoFixFeedback).toBe(true);
      expect(thread!.autoMergePR).toBe(true);
      expect(thread!.skipSetup).toBe(true);
    });

    it("should fail for non-owner", async () => {
      await mockLoggedInUser(otherUserSession);
      await expect(
        updateDraft({ threadId, updates: { autoFixFeedback: true } }),
      ).rejects.toThrow();
    });

    it("should fail for non-draft thread", async () => {
      // Create a non-draft thread (no draftMessage)
      const nonDraftThread = await createTestThread({
        db,
        userId: user.id,
        // Don't set draftMessage
      });

      await mockLoggedInUser(session);
      await expect(
        updateDraft({
          threadId: nonDraftThread.threadId,
          updates: { autoFixFeedback: true },
        }),
      ).rejects.toThrow("Task is not a draft");
    });
  });
});
