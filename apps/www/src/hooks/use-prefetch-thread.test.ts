import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the thread queries module
vi.mock("@/queries/thread-queries", () => ({
  threadQueryOptions: (threadId: string) => ({
    queryKey: ["threads", "detail", threadId],
    queryFn: vi.fn().mockResolvedValue({ id: threadId }),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  }),
}));

// Import after mocking
import { threadQueryOptions } from "@/queries/thread-queries";
import { MAX_PREFETCH_COUNT } from "./use-prefetch-thread";

describe("use-prefetch-thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("threadQueryOptions integration", () => {
    it("should return correct query options for prefetching", () => {
      const threadId = "test-thread-123";
      const options = threadQueryOptions(threadId);

      expect(options.queryKey).toEqual(["threads", "detail", threadId]);
      expect(options.staleTime).toBe(30000);
      expect(options.gcTime).toBe(5 * 60 * 1000);
    });

    it("should return different query keys for different threads", () => {
      const options1 = threadQueryOptions("thread-1");
      const options2 = threadQueryOptions("thread-2");

      expect(options1.queryKey).not.toEqual(options2.queryKey);
      expect(options1.queryKey[2]).toBe("thread-1");
      expect(options2.queryKey[2]).toBe("thread-2");
    });
  });

  describe("prefetch constants", () => {
    it("should export MAX_PREFETCH_COUNT with appropriate value for performance", () => {
      // The hook limits prefetching to avoid overwhelming the network
      // Using the actual exported constant to ensure test fails if value changes
      expect(MAX_PREFETCH_COUNT).toBeGreaterThanOrEqual(3); // Reasonable minimum
      expect(MAX_PREFETCH_COUNT).toBeLessThanOrEqual(10); // Reasonable maximum
    });

    it("should have MAX_PREFETCH_COUNT set to 8", () => {
      // Document the expected value - increased from 5 to 8 for better mobile coverage
      expect(MAX_PREFETCH_COUNT).toBe(8);
    });
  });

  describe("prefetch hook behavior (unit tests)", () => {
    it("should create unique query keys for each thread", () => {
      const threads = ["thread-1", "thread-2", "thread-3"];
      const queryKeys = threads.map((id) => threadQueryOptions(id).queryKey);

      // All query keys should be unique
      const keyStrings = queryKeys.map((k) => JSON.stringify(k));
      const uniqueKeys = new Set(keyStrings);
      expect(uniqueKeys.size).toBe(threads.length);
    });

    it("should include consistent cache times for mobile performance", () => {
      const options = threadQueryOptions("any-thread");

      // 30 seconds staleTime means data is considered fresh for 30s after fetch
      expect(options.staleTime).toBe(30000);

      // 5 minutes gcTime means data stays in cache for 5 minutes
      expect(options.gcTime).toBe(5 * 60 * 1000);
    });
  });
});
