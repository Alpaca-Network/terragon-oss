import { describe, it, vi, beforeEach, expect } from "vitest";
import {
  sendToBacklog as sendToBacklogServerAction,
  removeFromBacklog as removeFromBacklogServerAction,
} from "./backlog-thread";
import { db } from "@/lib/db";
import {
  createTestUser,
  createTestThread,
} from "@terragon/shared/model/test-helpers";
import { mockLoggedInUser, mockLoggedOutUser } from "@/test-helpers/mock-next";
import { User, Session } from "@terragon/shared";
import { unwrapResult } from "@/lib/server-actions";
import { getThread } from "@terragon/shared/model/threads";

const sendToBacklog = async (threadId: string) => {
  return unwrapResult(await sendToBacklogServerAction(threadId));
};

const removeFromBacklog = async (threadId: string) => {
  return unwrapResult(await removeFromBacklogServerAction(threadId));
};

describe("backlog-thread", () => {
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
    const createTestThreadResult = await createTestThread({
      db,
      userId: user.id,
    });
    threadId = createTestThreadResult.threadId;
    otherUserSession = otherUserResult.session;
  });

  describe("sendToBacklog", () => {
    it("should throw error when user is not authenticated", async () => {
      await mockLoggedOutUser();
      await expect(sendToBacklog(threadId)).rejects.toThrow("Unauthorized");
    });

    it("should set isBacklog to true for owner", async () => {
      await mockLoggedInUser(session);
      await sendToBacklog(threadId);

      const thread = await getThread({ db, userId: user.id, threadId });
      expect(thread).toBeDefined();
      expect(thread!.isBacklog).toBe(true);
    });

    it("should fail for non-owner", async () => {
      await mockLoggedInUser(otherUserSession);
      await expect(sendToBacklog(threadId)).rejects.toThrow();
    });
  });

  describe("removeFromBacklog", () => {
    it("should throw error when user is not authenticated", async () => {
      await mockLoggedOutUser();
      await expect(removeFromBacklog(threadId)).rejects.toThrow("Unauthorized");
    });

    it("should set isBacklog to false for owner", async () => {
      await mockLoggedInUser(session);
      // First send to backlog
      await sendToBacklog(threadId);
      let thread = await getThread({ db, userId: user.id, threadId });
      expect(thread!.isBacklog).toBe(true);

      // Then remove from backlog
      await removeFromBacklog(threadId);
      thread = await getThread({ db, userId: user.id, threadId });
      expect(thread).toBeDefined();
      expect(thread!.isBacklog).toBe(false);
    });

    it("should fail for non-owner", async () => {
      await mockLoggedInUser(otherUserSession);
      await expect(removeFromBacklog(threadId)).rejects.toThrow();
    });
  });
});
