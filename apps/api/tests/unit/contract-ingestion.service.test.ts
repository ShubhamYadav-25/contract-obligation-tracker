import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../src/config/logger.js";
import type { TransactionManager } from "../../src/infrastructure/database/transaction-manager.js";
import type { StorageProvider } from "../../src/infrastructure/storage/storage-provider.js";
import type { AuditRepository } from "../../src/modules/audit/audit.repository.js";
import { ContractIngestionService } from "../../src/modules/contracts/contract-ingestion.service.js";
import type {
  ContractDocumentRepository,
  ContractProcessingRepository,
  ContractRepository,
  ExistingContractDocument,
} from "../../src/modules/contracts/contracts.repository.js";
import { FileHashService } from "../../src/modules/contracts/file-hash.service.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const uploadedBy = "00000000-0000-4000-8000-000000000002";
const validPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF");

function logger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createExistingDocument(): ExistingContractDocument {
  const contractId = randomUUID();
  const documentId = randomUUID();

  return {
    contract: {
      id: contractId,
      organizationId,
      uploadedBy,
      displayName: "Existing",
      status: "DRAFT",
      currentDocumentId: documentId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    document: {
      id: documentId,
      organizationId,
      contractId,
      versionNumber: 1,
      originalFilename: "contract.pdf",
      storageProvider: "fake",
      storageBucket: "contracts",
      storageKey: "key",
      mimeType: "application/pdf",
      fileSizeBytes: validPdf.byteLength,
      fileHashSha256: "a".repeat(64),
      uploadStatus: "STORED",
      sourceType: "USER_UPLOAD",
      uploadedBy,
      uploadedAt: new Date(),
    },
    processingRun: {
      id: randomUUID(),
      contractId,
      documentId,
      status: "STORED",
      attemptNumber: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

function createDependencies(
  overrides: Partial<{
    duplicate: ExistingContractDocument | null;
    duplicateAfterUniqueViolation: ExistingContractDocument | null;
    storageUploadFails: boolean;
    pendingTransactionFails: boolean;
    pendingUniqueViolation: boolean;
    finalizationTransactionFails: boolean;
  }> = {},
) {
  const calls = {
    storageUploads: 0,
    storageDeletes: 0,
    contractsCreated: 0,
    documentsCreated: 0,
    documentsStored: 0,
    documentsFailed: 0,
    currentDocumentsAssigned: 0,
    runsCreated: 0,
    jobsQueued: 0,
    audits: 0,
  };
  const duplicate = overrides.duplicate ?? null;
  let duplicateLookupCount = 0;
  const contracts: ContractRepository = {
    findById: vi.fn(),
    findBySha256: vi.fn(),
    create: vi.fn(async (input) => {
      calls.contractsCreated += 1;
      return {
        id: input.id,
        organizationId: input.organizationId,
        uploadedBy: input.uploadedBy,
        displayName: input.displayName,
        status: "DRAFT" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),
    assignCurrentDocument: vi.fn(async () => {
      calls.currentDocumentsAssigned += 1;
    }),
  };
  const documents: ContractDocumentRepository = {
    findByOrganizationAndHash: vi.fn(async () => {
      duplicateLookupCount += 1;
      if (duplicateLookupCount > 1 && overrides.duplicateAfterUniqueViolation) {
        return overrides.duplicateAfterUniqueViolation;
      }
      return duplicate;
    }),
    findStoredForProcessing: vi.fn(),
    createPending: vi.fn(async (input) => {
      if (overrides.pendingUniqueViolation) {
        throw { code: "23505" };
      }
      calls.documentsCreated += 1;
      return {
        ...input,
        uploadedAt: new Date(),
      };
    }),
    markStored: vi.fn(async (input) => {
      calls.documentsStored += 1;
      return {
        id: input.documentId,
        organizationId,
        contractId: randomUUID(),
        versionNumber: 1,
        originalFilename: "contract.pdf",
        storageProvider: "fake",
        storageBucket: "contracts",
        storageKey: "key",
        mimeType: "application/pdf" as const,
        fileSizeBytes: validPdf.byteLength,
        fileHashSha256: new FileHashService().sha256(validPdf),
        uploadStatus: "STORED" as const,
        sourceType: "USER_UPLOAD" as const,
        uploadedBy,
        uploadedAt: new Date(),
      };
    }),
    markUploadFailed: vi.fn(async (input) => {
      calls.documentsFailed += 1;
      return {
        id: input.documentId,
        organizationId,
        contractId: randomUUID(),
        versionNumber: 1,
        originalFilename: "contract.pdf",
        storageProvider: "fake",
        storageBucket: "contracts",
        storageKey: "key",
        mimeType: "application/pdf" as const,
        fileSizeBytes: validPdf.byteLength,
        fileHashSha256: new FileHashService().sha256(validPdf),
        uploadStatus: "UPLOAD_FAILED" as const,
        uploadErrorCode: input.errorCode,
        uploadErrorMessage: input.errorMessage,
        uploadFailedAt: new Date(),
        sourceType: "USER_UPLOAD" as const,
        uploadedBy,
        uploadedAt: new Date(),
      };
    }),
  };
  const processingRuns: ContractProcessingRepository = {
    createRun: vi.fn(async (input) => {
      calls.runsCreated += 1;
      return {
        id: input.id,
        contractId: input.contractId,
        documentId: input.documentId,
        status: input.status,
        attemptNumber: input.attemptNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),
    markQueued: vi.fn(),
    findLatestByContractId: vi.fn(),
    findById: vi.fn(),
    claimForProcessing: vi.fn(),
    markCompleted: vi.fn(),
    markReviewRequired: vi.fn(),
    markRetryableFailure: vi.fn(),
    markFailed: vi.fn(),
    markStage: vi.fn(),
    markTextSegmented: vi.fn(),
  };
  const processingQueue = {
    enqueue: vi.fn(async () => {
      calls.jobsQueued += 1;
      return "contract-processing:document";
    }),
  };
  const storage: StorageProvider = {
    upload: vi.fn(async (input) => {
      calls.storageUploads += 1;
      if (overrides.storageUploadFails) {
        throw new Error("storage failed");
      }
      return {
        provider: "fake",
        bucket: "contracts",
        objectKey: input.objectKey ?? "object",
      };
    }),
    download: vi.fn(),
    downloadStream: vi.fn(),
    remove: vi.fn(),
    delete: vi.fn(async () => {
      calls.storageDeletes += 1;
    }),
    createSignedUrl: vi.fn(),
    createSignedDownloadUrl: vi.fn(),
  };
  let transactionCount = 0;
  const transactions: TransactionManager = {
    inTransaction: vi.fn(async (work) => {
      transactionCount += 1;
      if (overrides.pendingTransactionFails && transactionCount === 1) {
        throw new Error("pending transaction failed");
      }
      if (overrides.finalizationTransactionFails && transactionCount === 2) {
        throw new Error("finalization transaction failed");
      }
      return work({ client: {} as never });
    }),
  };
  const audit: AuditRepository = {
    append: vi.fn(async () => {
      calls.audits += 1;
    }),
  };

  return {
    calls,
    service: new ContractIngestionService({
      contracts,
      documents,
      processingRuns,
      processingQueue,
      audit,
      storage,
      storageMetadata: {
        provider: "fake",
        bucket: "contracts",
      },
      fileHash: new FileHashService(),
      transactions,
      validation: {
        maxFileSizeBytes: 1024,
        maxPageCount: 10,
      },
      logger: logger(),
    }),
  };
}

function uploadInput() {
  return {
    file: {
      originalFilename: "contract.pdf",
      mimeType: "application/pdf",
      sizeBytes: validPdf.byteLength,
      body: validPdf,
    },
    organizationId,
    uploadedBy,
    sourceType: "USER_UPLOAD" as const,
    correlationId: "test",
  };
}

describe("ContractIngestionService", () => {
  it("creates pending metadata, stores the file, finalizes metadata, writes audit, and returns stored tracking", async () => {
    const { service, calls } = createDependencies();

    const result = await service.ingest(uploadInput());

    expect(result.status).toBe("STORED");
    expect(result.uploadStatus).toBe("stored");
    expect(result.isDuplicate).toBe(false);
    expect(calls.contractsCreated).toBe(1);
    expect(calls.documentsCreated).toBe(1);
    expect(calls.storageUploads).toBe(1);
    expect(calls.documentsStored).toBe(1);
    expect(calls.currentDocumentsAssigned).toBe(1);
    expect(calls.runsCreated).toBe(1);
    expect(calls.jobsQueued).toBe(1);
    expect(calls.audits).toBe(2);
  });

  it("does not upload storage when pending metadata cannot be created", async () => {
    const { service, calls } = createDependencies({ pendingTransactionFails: true });

    await expect(service.ingest(uploadInput())).rejects.toMatchObject({
      code: "CONTRACT_PERSISTENCE_FAILED",
    });
    expect(calls.storageUploads).toBe(0);
    expect(calls.documentsFailed).toBe(0);
  });

  it("marks pending metadata failed when storage upload fails", async () => {
    const { service, calls } = createDependencies({ storageUploadFails: true });

    await expect(service.ingest(uploadInput())).rejects.toMatchObject({
      code: "STORAGE_UPLOAD_FAILED",
    });
    expect(calls.documentsCreated).toBe(1);
    expect(calls.documentsFailed).toBe(1);
    expect(calls.documentsStored).toBe(0);
  });

  it("attempts storage compensation and marks failed when database finalization fails", async () => {
    const { service, calls } = createDependencies({ finalizationTransactionFails: true });

    await expect(service.ingest(uploadInput())).rejects.toMatchObject({
      code: "CONTRACT_PERSISTENCE_FAILED",
    });
    expect(calls.storageUploads).toBe(1);
    expect(calls.storageDeletes).toBe(1);
    expect(calls.documentsFailed).toBe(1);
  });

  it("returns existing active documents as duplicates without storage upload", async () => {
    const { service, calls } = createDependencies({ duplicate: createExistingDocument() });

    const result = await service.ingest(uploadInput());

    expect(result.uploadStatus).toBe("duplicate");
    expect(result.isDuplicate).toBe(true);
    expect(calls.storageUploads).toBe(0);
    expect(calls.documentsCreated).toBe(0);
    expect(calls.jobsQueued).toBe(0);
  });

  it("resolves concurrent duplicate inserts by returning the surviving document", async () => {
    const survivingDocument = createExistingDocument();
    const { service, calls } = createDependencies({
      pendingUniqueViolation: true,
      duplicateAfterUniqueViolation: survivingDocument,
    });

    const result = await service.ingest(uploadInput());

    expect(result.isDuplicate).toBe(true);
    expect(result.contractId).toBe(survivingDocument.contract.id);
    expect(calls.storageUploads).toBe(0);
    expect(calls.jobsQueued).toBe(0);
  });
});
