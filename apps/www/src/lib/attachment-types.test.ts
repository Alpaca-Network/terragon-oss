import { describe, it, expect } from "vitest";
import {
  getFileTypeFromMimeTypeOrNull,
  isSupportedAttachmentType,
  type Attachment,
} from "./attachment-types";

describe("attachment-types", () => {
  describe("getFileTypeFromMimeTypeOrNull", () => {
    it("should identify image MIME types", () => {
      expect(getFileTypeFromMimeTypeOrNull("image/png")).toBe("image");
      expect(getFileTypeFromMimeTypeOrNull("image/jpeg")).toBe("image");
      expect(getFileTypeFromMimeTypeOrNull("image/gif")).toBe("image");
    });

    it("should identify PDF MIME type", () => {
      expect(getFileTypeFromMimeTypeOrNull("application/pdf")).toBe("pdf");
    });

    it("should identify text MIME types", () => {
      expect(getFileTypeFromMimeTypeOrNull("text/plain")).toBe("text-file");
      expect(getFileTypeFromMimeTypeOrNull("text/html")).toBe("text-file");
      expect(getFileTypeFromMimeTypeOrNull("application/json")).toBe(
        "text-file",
      );
    });

    it("should return null for unsupported MIME types", () => {
      expect(getFileTypeFromMimeTypeOrNull("video/mp4")).toBeNull();
      expect(getFileTypeFromMimeTypeOrNull("audio/mp3")).toBeNull();
    });
  });

  describe("isSupportedAttachmentType", () => {
    it("should return true for supported types", () => {
      expect(isSupportedAttachmentType("image/png")).toBe(true);
      expect(isSupportedAttachmentType("application/pdf")).toBe(true);
      expect(isSupportedAttachmentType("text/plain")).toBe(true);
    });

    it("should return false for unsupported types", () => {
      expect(isSupportedAttachmentType("video/mp4")).toBe(false);
      expect(isSupportedAttachmentType("audio/mp3")).toBe(false);
    });
  });

  describe("Attachment type with lineCount", () => {
    it("should allow lineCount field in attachment", () => {
      const attachment: Attachment = {
        id: "test-id",
        mimeType: "text/plain",
        fileType: "text-file",
        fileName: "pasted-text.txt",
        lineCount: 150,
        uploadStatus: "pending",
        base64: "data:text/plain;base64,SGVsbG8gV29ybGQ=",
        file: new File(["Hello World"], "pasted-text.txt", {
          type: "text/plain",
        }),
      };

      expect(attachment.lineCount).toBe(150);
      expect(attachment.fileType).toBe("text-file");
    });

    it("should allow attachment without lineCount field", () => {
      const attachment: Attachment = {
        id: "test-id",
        mimeType: "text/plain",
        fileType: "text-file",
        fileName: "test.txt",
        uploadStatus: "pending",
        base64: "data:text/plain;base64,SGVsbG8gV29ybGQ=",
        file: new File(["Hello World"], "test.txt", { type: "text/plain" }),
      };

      expect(attachment.lineCount).toBeUndefined();
      expect(attachment.fileType).toBe("text-file");
    });
  });
});
