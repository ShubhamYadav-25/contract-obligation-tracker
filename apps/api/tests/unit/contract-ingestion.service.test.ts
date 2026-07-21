import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../src/config/logger.js";
import type { StorageProvider } from "../../src/infrastructure/storage/storage-provider.js";
import type { TransactionManager } from "../../src/infrastructure/database/transaction-manager.js";
import type { AuditRepository } from "../../src/modules/audit/audit.repository.js";
import type { ContractProcessingQueue } from "../../src/modules/contracts/contract-processing.queue.js";
import { ContractIngestionService } from "../../src/modules/contracts/contract-ingestion.service.js";
import { FileHashService } from "../../src/modules/contracts/file-hash.service.js";
import type {
  ContractDocumentRepository,
  ContractProcessingRepository,
  ContractRepository,
  ExistingContractDocument,
} from "../../src/modules/contracts/contracts.repository.js";

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

function createDependencies(
  overrides: Partial<{
    duplicate: ExistingContractDocument | null;
    storageUploadFails: boolean;
    transactionFails: boolean;
    queueFails: boolean;
  }> = {},
) {
  const calls = {
    storageUploads: 0,
    storageDeletes: 0,
    contractsCreated: 0,
    documentsCreated: 0,
    runsCreated: 0,
    audits: 0,
    queued: 0,
  };
  const contractId = randomUUID();
  const documentId = randomUUID();
  const processingRunId = randomUUID();
  const duplicate = overrides.duplicate ?? null;
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
    assignCurrentDocument: vi.fn(),
  };
  const documents: ContractDocumentRepository = {
    findByOrganizationAndHash: vi.fn(async () => duplicate),
    create: vi.fn(async (input) => {
      calls.documentsCreated += 1;
      return {
        ...input,
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
    markQueued: vi.fn(async (input) => ({
      id: input.processingRunId,
      contractId,
      documentId,
      status: "QUEUED" as const,
      attemptNumber: 1,
      queueJobId: input.queueJobId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findLatestByContractId: vi.fn(),
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
    remove: vi.fn(),
    delete: vi.fn(async () => {
      calls.storageDeletes += 1;
    }),
    createSignedUrl: vi.fn(),
    createSignedDownloadUrl: vi.fn(),
  };
  const transactions: TransactionManager = {
    inTransaction: vi.fn(async (work) => {
      if (overrides.transactionFails) {
        throw new Error("database failed");
      }
      return work({ client: {} as never });
    }),
  };
  const audit: AuditRepository = {
    append: vi.fn(async () => {
      calls.audits += 1;
    }),
  };
  const queue: ContractProcessingQueue = {
    enqueue: vi.fn(async () => {
      calls.queued += 1;
      if (overrides.queueFails) {
        throw new Error("queue failed");
      }
      return "job-id";
    }),
  };

  return {
    calls,
    service: new ContractIngestionService({
      contracts,
      documents,
      processingRuns,
      audit,
      storage,
      fileHash: new FileHashService(),
      queue,
      transactions,
      validation: {
        maxFileSizeBytes: 1024,
        maxPageCount: 10,
      },
      logger: logger(),
    }),
    duplicate,
    processingRunId,
    contractId,
    documentId,
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
  it("stores metadata, writes audit, enqueues, and returns queued tracking", async () => {
    const { service, calls } = createDependencies();

    const result = await service.ingest(uploadInput());

    expect(result.status).toBe("QUEUED");
    expect(result.duplicate).toBe(false);
    expect(calls.storageUploads).toBe(1);
    expect(calls.documentsCreated).toBe(1);
    expect(calls.runsCreated).toBe(1);
    expect(calls.audits).toBe(1);
    expect(calls.queued).toBe(1);
  });

  it("does not write database records when storage fails", async () => {
    const { service, calls } = createDependencies({ storageUploadFails: true });

    await expect(service.ingest(uploadInput())).rejects.toMatchObject({
      code: "STORAGE_UPLOAD_FAILED",
    });
    expect(calls.contractsCreated).toBe(0);
  });

  it("attempts storage compensation when the database transaction fails", async () => {
    const { service, calls } = createDependencies({ transactionFails: true });

    await expect(service.ingest(uploadInput())).rejects.toMatchObject({
      code: "CONTRACT_PERSISTENCE_FAILED",
    });
    expect(calls.storageDeletes).toBe(1);
  });

  it("leaves accepted contracts stored when queue publish fails", async () => {
    const { service } = createDependencies({ queueFails: true });

    const result = await service.ingest(uploadInput());

    expect(result.status).toBe("STORED");
    expect(result.duplicate).toBe(false);
  });

  it("returns existing documents as duplicates without storage upload", async () => {
    const existing: ExistingContractDocument = {
      contract: {
        id: randomUUID(),
        organizationId,
        uploadedBy,
        displayName: "Existing",
        status: "DRAFT",
        currentDocumentId: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      document: {
        id: randomUUID(),
        organizationId,
        contractId: randomUUID(),
        versionNumber: 1,
        originalFilename: "contract.pdf",
        storageProvider: "fake",
        storageBucket: "contracts",
        storageKey: "key",
        mimeType: "application/pdf",
        fileSizeBytes: 10,
        fileHashSha256: "a".repeat(64),
        sourceType: "USER_UPLOAD",
        uploadedBy,
        uploadedAt: new Date(),
      },
      processingRun: {
        id: randomUUID(),
        contractId: randomUUID(),
        documentId: randomUUID(),
        status: "QUEUED",
        attemptNumber: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    const { service, calls } = createDependencies({ duplicate: existing });

    const result = await service.ingest(uploadInput());

    expect(result.duplicate).toBe(true);
    expect(calls.storageUploads).toBe(0);
  });
});
