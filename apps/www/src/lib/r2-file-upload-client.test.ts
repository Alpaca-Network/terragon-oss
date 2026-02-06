import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadFileToR2, uploadImageToR2 } from "./r2-file-upload-client";

// Mock the server action
vi.mock("@/server-actions/generate-file-upload-url", () => ({
  generateFileUploadUrl: vi.fn(),
}));

// Mock unwrapResult to extract data from ServerActionResult
vi.mock("@/lib/server-actions", () => ({
  unwrapResult: vi.fn((result: { success: boolean; data?: unknown }) => {
    if (!result.success) {
      throw new Error("Server action failed");
    }
    return result.data;
  }),
}));

import { generateFileUploadUrl } from "@/server-actions/generate-file-upload-url";

describe("r2-file-upload-client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("uploadFileToR2", () => {
    it("should upload file with credentials: omit to prevent auth header conflicts", async () => {
      const presignedUrl =
        "https://test-bucket.r2.cloudflarestorage.com/uploads/test.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...";
      const publicUrl = "https://public.example.com/uploads/test.png";
      const r2Key = "uploads/test.png";

      // Mock returns ServerActionResult wrapper (cast as any for type compatibility)
      vi.mocked(generateFileUploadUrl).mockResolvedValue({
        success: true,
        data: { presignedUrl, publicUrl, r2Key },
      } as any);

      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

      // Create a mock File
      const file = new File(["test content"], "test.png", {
        type: "image/png",
      });

      await uploadFileToR2({ file, fileType: "image" });

      // Verify fetch was called with credentials: "omit"
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(presignedUrl);
      expect(options.method).toBe("PUT");
      expect(options.credentials).toBe("omit");
      expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
        "image/png",
      );
    });

    it("should throw error when upload fails", async () => {
      const presignedUrl = "https://test-bucket.r2.cloudflarestorage.com/test";
      const publicUrl = "https://public.example.com/test";
      const r2Key = "test";

      vi.mocked(generateFileUploadUrl).mockResolvedValue({
        success: true,
        data: { presignedUrl, publicUrl, r2Key },
      } as any);

      fetchMock.mockResolvedValue(
        new Response("InvalidArgument: Authorization", { status: 400 }),
      );

      const file = new File(["test"], "test.png", { type: "image/png" });

      await expect(uploadFileToR2({ file, fileType: "image" })).rejects.toThrow(
        "Upload failed: InvalidArgument: Authorization",
      );
    });

    it("should throw error when no public URL is returned", async () => {
      const presignedUrl = "https://test-bucket.r2.cloudflarestorage.com/test";
      const r2Key = "test";

      vi.mocked(generateFileUploadUrl).mockResolvedValue({
        success: true,
        data: { presignedUrl, publicUrl: undefined, r2Key },
      } as any);

      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

      const file = new File(["test"], "test.png", { type: "image/png" });

      await expect(uploadFileToR2({ file, fileType: "image" })).rejects.toThrow(
        "No public URL found",
      );
    });
  });

  describe("uploadImageToR2", () => {
    it("should call uploadFileToR2 with image fileType", async () => {
      const presignedUrl = "https://test-bucket.r2.cloudflarestorage.com/test";
      const publicUrl = "https://public.example.com/test";
      const r2Key = "test";

      vi.mocked(generateFileUploadUrl).mockResolvedValue({
        success: true,
        data: { presignedUrl, publicUrl, r2Key },
      } as any);

      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

      const file = new File(["test"], "test.png", { type: "image/png" });

      const result = await uploadImageToR2(file);

      expect(result.r2Url).toBe(publicUrl);
      expect(result.r2Key).toBe(r2Key);

      // Verify generateFileUploadUrl was called with image fileType
      expect(generateFileUploadUrl).toHaveBeenCalledWith({
        fileType: "image",
        contentType: "image/png",
        sizeInBytes: file.size,
      });
    });
  });
});
