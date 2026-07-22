import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { requestCorrelationMiddleware } from "../../src/shared/middleware/request-correlation.middleware.js";
import { errorMiddleware } from "../../src/shared/middleware/error.middleware.js";
import { createContractRouter } from "../../src/modules/contracts/contracts.routes.js";
import type { ContractIngestionService } from "../../src/modules/contracts/contract-ingestion.service.js";
import type {
  ContractTrackingResult,
  ContractWorkspaceRecord,
  DocumentTextPageRecord,
} from "../../src/modules/contracts/contracts.types.js";

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

function createTestApp(service: object) {
  const app = express();
  app.use(requestCorrelationMiddleware);
  app.use(
    "/api/v1/contracts",
    createContractRouter(() => service as ContractIngestionService),
  );
  app.use(errorMiddleware);
  return app;
}

function createWorkspaceRecord(): ContractWorkspaceRecord {
  const createdAt = new Date("2026-07-21T00:00:00.000Z");
  const contractId = "00000000-0000-4000-8000-000000000003";
  const documentId = "00000000-0000-4000-8000-000000000004";

  return {
    contract: {
      id: contractId,
      organizationId,
      uploadedBy: userId,
      displayName: "Vendor Agreement",
      status: "DRAFT",
      currentDocumentId: documentId,
      createdAt,
      updatedAt: createdAt,
    },
    currentDocument: {
      id: documentId,
      organizationId,
      contractId,
      versionNumber: 1,
      originalFilename: "vendor.pdf",
      storageProvider: "supabase",
      storageBucket: "contracts",
      storageKey: "organizations/org/contracts/contract/documents/document/original.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 128,
      fileHashSha256: "a".repeat(64),
      uploadStatus: "STORED",
      sourceType: "USER_UPLOAD",
      uploadedBy: userId,
      uploadedAt: createdAt,
    },
    latestProcessingRun: {
      id: "00000000-0000-4000-8000-000000000005",
      contractId,
      documentId,
      status: "TEXT_SEGMENTED",
      attemptNumber: 1,
      queueJobId: "contract-processing:document",
      completedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    },
    text: {
      pageCount: 2,
      segmentCount: 5,
      ocrPageCount: 1,
    },
  };
}

function createTextPageRecord(): DocumentTextPageRecord {
  return {
    organizationId,
    contractId: "00000000-0000-4000-8000-000000000003",
    documentId: "00000000-0000-4000-8000-000000000004",
    processingRunId: "00000000-0000-4000-8000-000000000005",
    pageNumber: 1,
    extractionMethod: "PDF_TEXT",
    rawText: "Section 1. Payment is due monthly.",
    normalizedText: "Section 1. Payment is due monthly.",
    charCount: 35,
    wordCount: 6,
    printableRatio: 1,
    segments: [
      {
        documentId: "00000000-0000-4000-8000-000000000004",
        pageNumber: 1,
        lineStart: 1,
        lineEnd: 1,
        text: "Section 1. Payment is due monthly.",
        normalizedText: "Section 1. Payment is due monthly.",
        startOffset: 0,
        endOffset: 35,
        extractionMethod: "PDF_TEXT",
      },
    ],
    warnings: [],
    createdAt: new Date("2026-07-21T00:00:00.000Z"),
  };
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

  it("lists backend contracts with processing and text summary fields", async () => {
    const service = {
      listContracts: vi.fn(async () => [createWorkspaceRecord()]),
    };

    const response = await request(createTestApp(service))
      .get("/api/v1/contracts")
      .set("x-user-id", userId)
      .set("x-organization-id", organizationId)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      displayName: "Vendor Agreement",
      processing: {
        status: "TEXT_SEGMENTED",
        attemptNumber: 1,
      },
      text: {
        pageCount: 2,
        segmentCount: 5,
        ocrPageCount: 1,
      },
    });
    expect(service.listContracts).toHaveBeenCalledWith({
      organizationId,
      limit: 50,
      offset: 0,
    });
  });

  it("returns parsed text pages for a contract workspace", async () => {
    const service = {
      findContract: vi.fn(async () => createWorkspaceRecord()),
      listDocumentTextPages: vi.fn(async () => [createTextPageRecord()]),
    };

    const response = await request(createTestApp(service))
      .get("/api/v1/contracts/00000000-0000-4000-8000-000000000003/text-pages")
      .set("x-user-id", userId)
      .set("x-organization-id", organizationId)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pages[0]).toMatchObject({
      pageNumber: 1,
      extractionMethod: "PDF_TEXT",
      segments: [
        {
          lineStart: 1,
          lineEnd: 1,
          normalizedText: "Section 1. Payment is due monthly.",
        },
      ],
    });
    expect(service.listDocumentTextPages).toHaveBeenCalledWith({
      organizationId,
      contractId: "00000000-0000-4000-8000-000000000003",
    });
  });
});
