/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it } from "vitest";

import { uploadContractResultSchema } from "./upload-contract.js";

describe("uploadContractResultSchema", () => {
  it("normalizes string byte counts returned by PostgreSQL-backed upload responses", () => {
    const result = uploadContractResultSchema.parse({
      contractId: "00000000-0000-4000-8000-000000000003",
      documentId: "00000000-0000-4000-8000-000000000004",
      processingRunId: "00000000-0000-4000-8000-000000000005",
      status: "STORED",
      uploadStatus: "stored",
      isDuplicate: false,
      duplicate: false,
      originalFilename: "contract.pdf",
      mimeType: "application/pdf",
      sizeBytes: "128",
      checksumSha256: "a".repeat(64),
      createdAt: "2026-07-21T00:00:00.000Z",
    });

    expect(result.sizeBytes).toBe(128);
  });
});
