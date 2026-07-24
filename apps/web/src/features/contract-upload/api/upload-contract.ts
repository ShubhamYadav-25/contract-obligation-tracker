import { z } from "zod";

import { uploadMultipart } from "@/services/api-client.js";

export const uploadContractResultSchema = z.object({
  contractId: z.string(),
  documentId: z.string(),
  processingRunId: z.string(),
  status: z.literal("STORED"),
  uploadStatus: z.enum(["stored", "duplicate"]),
  isDuplicate: z.boolean(),
  duplicate: z.boolean(),
  originalFilename: z.string(),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.coerce.number(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string(),
});

export type UploadContractResult = z.infer<typeof uploadContractResultSchema>;

export type UploadContractInput = {
  readonly file: File;
  readonly title?: string;
  readonly displayName?: string;
  readonly externalRef?: string;
};

export function uploadContract(rawInput: File | UploadContractInput) {
  const input = rawInput instanceof File ? { file: rawInput } : rawInput;
  const formData = new FormData();
  formData.append("file", input.file);
  const title = input.title ?? input.displayName;
  if (title) {
    formData.append("title", title);
  }
  if (input.externalRef) {
    formData.append("externalRef", input.externalRef);
  }
  return uploadMultipart<UploadContractResult>("/api/v1/contracts", formData, {
    responseSchema: uploadContractResultSchema,
  });
}
