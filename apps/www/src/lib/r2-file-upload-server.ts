import { generateFileUploadUrlForUser } from "@/server-lib/r2-file-upload";
import { DBUserMessage } from "@terragon/shared";

interface ParsedFile {
  buffer: ArrayBuffer;
  contentType: string;
}

async function base64ToBuffer(base64: string): Promise<ParsedFile> {
  try {
    const blob = await fetch(base64).then((res) => res.blob());
    const contentType = blob.type;
    const buffer = await blob.arrayBuffer();
    return { buffer, contentType };
  } catch (error) {
    const base64Preview = base64.slice(0, 100);
    throw new Error(
      `Failed to convert base64 to buffer (preview: ${base64Preview}...): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function uploadImageForUser({
  userId,
  base64Image,
}: {
  userId: string;
  base64Image: string;
}): Promise<string> {
  const { buffer, contentType } = await base64ToBuffer(base64Image);
  const { presignedUrl, publicUrl } = await generateFileUploadUrlForUser({
    userId,
    fileType: "image",
    contentType,
    sizeInBytes: buffer.byteLength,
  });
  const uploadResponse = await fetch(presignedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
    },
    body: buffer,
  });
  if (!uploadResponse.ok) {
    const responseText = await uploadResponse.text();
    throw new Error(
      `Image upload failed (status: ${uploadResponse.status}, size: ${buffer.byteLength}): ${responseText}`,
    );
  }
  if (!publicUrl) {
    throw new Error("No public URL found for image");
  }
  return publicUrl;
}

async function uploadPdfForUser({
  userId,
  base64Pdf,
}: {
  userId: string;
  base64Pdf: string;
}): Promise<string> {
  const { buffer, contentType } = await base64ToBuffer(base64Pdf);
  const { presignedUrl, publicUrl } = await generateFileUploadUrlForUser({
    userId,
    fileType: "pdf",
    contentType,
    sizeInBytes: buffer.byteLength,
  });
  const uploadResponse = await fetch(presignedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
    },
    body: buffer,
  });
  if (!uploadResponse.ok) {
    const responseText = await uploadResponse.text();
    throw new Error(
      `PDF upload failed (status: ${uploadResponse.status}, size: ${buffer.byteLength}): ${responseText}`,
    );
  }
  if (!publicUrl) {
    throw new Error("No public URL found for PDF");
  }
  return publicUrl;
}

async function uploadTextFileForUser({
  userId,
  base64TextFile,
}: {
  userId: string;
  base64TextFile: string;
}): Promise<string> {
  const { buffer, contentType } = await base64ToBuffer(base64TextFile);
  const { presignedUrl, publicUrl } = await generateFileUploadUrlForUser({
    userId,
    fileType: "text-file",
    contentType,
    sizeInBytes: buffer.byteLength,
  });
  const uploadResponse = await fetch(presignedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
    },
    body: buffer,
  });
  if (!uploadResponse.ok) {
    const responseText = await uploadResponse.text();
    throw new Error(
      `Text file upload failed (status: ${uploadResponse.status}, size: ${buffer.byteLength}): ${responseText}`,
    );
  }
  if (!publicUrl) {
    throw new Error("No public URL found for text file");
  }
  return publicUrl;
}

export async function uploadUserMessageImages({
  userId,
  message,
}: {
  userId: string;
  message: DBUserMessage;
}): Promise<DBUserMessage> {
  const r2UrlByImageUrl: Record<string, string> = {};
  const r2UrlByPdfUrl: Record<string, string> = {};
  const r2UrlByTextFileUrl: Record<string, string> = {};
  const results = await Promise.allSettled(
    message.parts.map(async (part) => {
      if (part.type === "image" && part.image_url.startsWith("data:")) {
        const r2Url = await uploadImageForUser({
          userId,
          base64Image: part.image_url,
        });
        r2UrlByImageUrl[part.image_url] = r2Url;
      } else if (part.type === "pdf" && part.pdf_url.startsWith("data:")) {
        const r2Url = await uploadPdfForUser({
          userId,
          base64Pdf: part.pdf_url,
        });
        r2UrlByPdfUrl[part.pdf_url] = r2Url;
      } else if (
        part.type === "text-file" &&
        part.file_url.startsWith("data:")
      ) {
        const r2Url = await uploadTextFileForUser({
          userId,
          base64TextFile: part.file_url,
        });
        r2UrlByTextFileUrl[part.file_url] = r2Url;
      }
    }),
  );
  const rejectedResults = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (rejectedResults.length > 0) {
    const errorMessages = rejectedResults.map((result) =>
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason),
    );
    throw new Error(`Failed to upload files: ${errorMessages.join("; ")}`);
  }
  return {
    ...message,
    parts: message.parts.map((part) => {
      if (part.type === "image") {
        return {
          ...part,
          image_url: r2UrlByImageUrl[part.image_url] ?? part.image_url,
        };
      } else if (part.type === "pdf") {
        return {
          ...part,
          pdf_url: r2UrlByPdfUrl[part.pdf_url] ?? part.pdf_url,
        };
      } else if (part.type === "text-file") {
        return {
          ...part,
          file_url: r2UrlByTextFileUrl[part.file_url] ?? part.file_url,
        };
      }
      return part;
    }),
  };
}

export async function uploadClaudeSessionToR2({
  userId,
  threadId,
  sessionId,
  contents,
}: {
  userId: string;
  threadId: string;
  sessionId: string;
  contents: string;
}) {
  const { presignedUrl, r2Key } = await generateFileUploadUrlForUser({
    userId,
    fileType: "claudeSession",
    contentType: "text/plain",
    sizeInBytes: Buffer.byteLength(contents),
    fileNamePrefix: `${threadId}/${sessionId}-`,
  });
  const uploadResponse = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: contents,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${await uploadResponse.text()}`);
  }
  return r2Key;
}
