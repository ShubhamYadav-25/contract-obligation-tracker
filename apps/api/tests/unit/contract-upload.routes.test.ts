import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { requestCorrelationMiddleware } from "../../src/shared/middleware/request-correlation.middleware.js";
import { errorMiddleware } from "../../src/shared/middleware/error.middleware.js";
import { createContractRouter } from "../../src/modules/contracts/contracts.routes.js";
import type { ContractIngestionService } from "../../src/modules/contracts/contract-ingestion.service.js";
import type { ContractTrackingResult } from "../../src/modules/contracts/contracts.types.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const validPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF");

function createUploadResult(
  overrides: Partial<ContractTrackingResult> = {},
): ContractTrackingResult {
  return {
    contractId: "00000000-0000-4000-8000-000000000003",
    documentId: "00000000-0000-4000-8000-000000000004",
    processingRunId: "00000000-0000-4000-8000-000000000005",
    status: "STORED",
    uploadStatus: "stored",
    isDuplicate: false,
    duplicate: false,
    originalFilename: "contract.pdf",
    mimeType: "application/pdf",
    sizeBytes: validPdf.byteLength,
    checksumSha256: "a".repeat(64),
    createdAt: new Date("2026-07-21T00:00:00.000Z").toISOString(),
    ...overrides,
  };
}

function createTestApp(service: Pick<ContractIngestionService, "ingest" | "findProcessingStatus">) {
  const app = express();
  app.use(requestCorrelationMiddleware);
  app.use(
    "/api/v1/contracts",
    createContractRouter(() => service as ContractIngestionService),
  );
  app.use(errorMiddleware);
  return app;
}

describe("contract upload route", () => {
  it("requires authenticated user and organization context", async () => {
    const service = {
      ingest: vi.fn(),
      findProcessingStatus: vi.fn(),
    };
    const response = await request(createTestApp(service)).post("/api/v1/contracts").expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(service.ingest).not.toHaveBeenCalled();
  });

  it("passes authenticated multipart PDF uploads to the ingestion service", async () => {
    const service = {
      ingest: vi.fn(async () => createUploadResult()),
      findProcessingStatus: vi.fn(),
    };

    const response = await request(createTestApp(service))
      .post("/api/v1/contracts")
      .set("x-user-id", userId)
      .set("x-organization-id", organizationId)
      .field("title", "Vendor Agreement")
      .attach("file", validPdf, {
        filename: "contract.pdf",
        contentType: "application/pdf",
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.uploadStatus).toBe("stored");
    expect(service.ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Vendor Agreement",
        organizationId,
        uploadedBy: userId,
        sourceType: "USER_UPLOAD",
      }),
    );
  });

  it("normalizes oversized multipart uploads before service execution", async () => {
    const service = {
      ingest: vi.fn(),
      findProcessingStatus: vi.fn(),
    };
    const oversizedPdf = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(21 * 1024 * 1024)]);

    const response = await request(createTestApp(service))
      .post("/api/v1/contracts")
      .set("x-user-id", userId)
      .set("x-organization-id", organizationId)
      .attach("file", oversizedPdf, {
        filename: "huge.pdf",
        contentType: "application/pdf",
      })
      .expect(413);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("FILE_TOO_LARGE");
    expect(service.ingest).not.toHaveBeenCalled();
  });
});
