import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../src/config/logger.js";
import type { TransactionContext, TransactionManager } from "../../src/infrastructure/database/transaction-manager.js";
import type { AuditRepository } from "../../src/modules/audit/audit.repository.js";
import type { AuditRecordInput } from "../../src/modules/audit/audit.types.js";
import { PermanentContractProcessingError, RetryableContractProcessingError } from "../../src/modules/contracts/contract-processing.errors.js";
import { ContractProcessingOrchestrator } from "../../src/modules/contracts/contract-processing-orchestrator.service.js";
import type { ContractProcessingPipeline } from "../../src/modules/contracts/contract-processing.pipeline.js";
import type {
  ClaimContractProcessingRunInput,
  CompleteContractProcessingRunInput,
  ContractProcessingRepository,
  FailContractProcessingRunInput,
} from "../../src/modules/contracts/contracts.repository.js";
import type { ContractProcessingRunRecord, ContractProcessingRunStatus } from "../../src/modules/contracts/contracts.types.js";

const command = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  contractId: "00000000-0000-4000-8000-000000000002",
  documentId: "00000000-0000-4000-8000-000000000003",
  processingRunId: "00000000-0000-4000-8000-000000000004",
  jobId: "job-1",
  queueJobId: "contract:process:1",
  attemptNumber: 1,
};

const transaction = {} as TransactionContext;

class FakeTransactionManager implements TransactionManager {
  inTransaction<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    return work(transaction);
  }
}

class FakeProcessingRepository implements ContractProcessingRepository {
  run: ContractProcessingRunRecord;
  readonly calls = {
    claim: 0,
    completed: 0,
    reviewRequired: 0,
    retryableFailure: 0,
    failed: 0,
  };

  constructor(status: ContractProcessingRunStatus = "QUEUED") {
    this.run = {
      id: command.processingRunId,
      contractId: command.contractId,
      documentId: command.documentId,
      status,
      attemptNumber: 0,
      queueJobId: command.queueJobId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async createRun(): Promise<ContractProcessingRunRecord> {
    return this.run;
  }

  async markQueued(): Promise<ContractProcessingRunRecord> {
    this.run = { ...this.run, status: "QUEUED" };
    return this.run;
  }

  async findLatestByContractId(): Promise<ContractProcessingRunRecord | null> {
    return this.run;
  }

  async findById(): Promise<ContractProcessingRunRecord | null> {
    return this.run;
  }

  async claimForProcessing(input: ClaimContractProcessingRunInput): Promise<ContractProcessingRunRecord | null> {
    this.calls.claim += 1;
    if (
      this.run.status === "QUEUED" ||
      (this.run.status === "PROCESSING" && this.run.attemptNumber < input.attemptNumber)
    ) {
      this.run = {
        ...this.run,
        status: "PROCESSING",
        attemptNumber: input.attemptNumber,
        startedAt: new Date(),
      };
      return this.run;
    }
    return null;
  }

  async markCompleted(_input: CompleteContractProcessingRunInput): Promise<ContractProcessingRunRecord> {
    this.calls.completed += 1;
    this.run = { ...this.run, status: "COMPLETED", completedAt: new Date() };
    return this.run;
  }

  async markReviewRequired(_input: CompleteContractProcessingRunInput): Promise<ContractProcessingRunRecord> {
    this.calls.reviewRequired += 1;
    this.run = { ...this.run, status: "REVIEW_REQUIRED", completedAt: new Date() };
    return this.run;
  }

  async markRetryableFailure(input: FailContractProcessingRunInput): Promise<ContractProcessingRunRecord> {
    this.calls.retryableFailure += 1;
    this.run = {
      ...this.run,
      status: "QUEUED",
      errorCode: input.errorCode,
      errorStage: input.errorStage,
      errorMessage: input.message,
      errorRetryable: true,
    };
    return this.run;
  }

  async markFailed(input: FailContractProcessingRunInput): Promise<ContractProcessingRunRecord> {
    this.calls.failed += 1;
    this.run = {
      ...this.run,
      status: "FAILED",
      errorCode: input.errorCode,
      errorStage: input.errorStage,
      errorMessage: input.message,
      errorRetryable: input.retryable,
      failedAt: new Date(),
      completedAt: new Date(),
    };
    return this.run;
  }
}

function setup(input: {
  readonly status?: ContractProcessingRunStatus;
  readonly pipeline: ContractProcessingPipeline;
}) {
  const processingRuns = new FakeProcessingRepository(input.status);
  const auditEvents: AuditRecordInput[] = [];
  const audit: AuditRepository = {
    append: vi.fn(async (event) => {
      auditEvents.push(event);
    }),
  };
  const logger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const orchestrator = new ContractProcessingOrchestrator({
    processingRuns,
    audit,
    transactions: new FakeTransactionManager(),
    pipeline: input.pipeline,
    logger,
  });

  return { auditEvents, logger, orchestrator, processingRuns };
}

describe("ContractProcessingOrchestrator", () => {
  it("marks successful processing completed and writes lifecycle audit events", async () => {
    const { auditEvents, orchestrator, processingRuns } = setup({
      pipeline: { run: vi.fn(async () => ({ outcome: "COMPLETED" as const })) },
    });

    const result = await orchestrator.processContract(command);

    expect(result).toEqual({ outcome: "CLAIMED_AND_COMPLETED", status: "COMPLETED" });
    expect(processingRuns.run.status).toBe("COMPLETED");
    expect(auditEvents.map((event) => event.action)).toEqual([
      "CONTRACT_PROCESSING_STARTED",
      "CONTRACT_PROCESSING_COMPLETED",
    ]);
  });

  it("marks review-required results accordingly", async () => {
    const { auditEvents, orchestrator, processingRuns } = setup({
      pipeline: {
        run: vi.fn(async () => ({ outcome: "REVIEW_REQUIRED" as const, reviewItemCount: 2 })),
      },
    });

    const result = await orchestrator.processContract(command);

    expect(result).toEqual({
      outcome: "CLAIMED_AND_REVIEW_REQUIRED",
      status: "REVIEW_REQUIRED",
    });
    expect(processingRuns.run.status).toBe("REVIEW_REQUIRED");
    expect(auditEvents.at(-1)?.action).toBe("CONTRACT_PROCESSING_REVIEW_REQUIRED");
  });

  it("does not reprocess terminal completed runs on duplicate delivery", async () => {
    const pipeline = { run: vi.fn(async () => ({ outcome: "COMPLETED" as const })) };
    const { orchestrator, processingRuns } = setup({ status: "COMPLETED", pipeline });

    const result = await orchestrator.processContract(command);

    expect(result).toEqual({
      outcome: "NO_OP",
      reason: "ALREADY_TERMINAL",
      status: "COMPLETED",
    });
    expect(pipeline.run).not.toHaveBeenCalled();
    expect(processingRuns.calls.completed).toBe(0);
  });

  it("records retryable pipeline failures and requeues the run before rethrowing", async () => {
    const { orchestrator, processingRuns } = setup({
      pipeline: {
        run: vi.fn(async () => {
          throw new RetryableContractProcessingError({
            code: "STORAGE_TEMPORARY_UNAVAILABLE",
            stage: "DOCUMENT_LOAD",
            message: "Storage is temporarily unavailable",
          });
        }),
      },
    });

    await expect(orchestrator.processContract(command)).rejects.toBeInstanceOf(
      RetryableContractProcessingError,
    );
    expect(processingRuns.run.status).toBe("QUEUED");
    expect(processingRuns.run.errorRetryable).toBe(true);
    expect(processingRuns.calls.retryableFailure).toBe(1);
  });

  it("records permanent pipeline failures as failed", async () => {
    const { auditEvents, orchestrator, processingRuns } = setup({
      pipeline: {
        run: vi.fn(async () => {
          throw new PermanentContractProcessingError({
            code: "INVALID_PDF",
            stage: "PARSE",
            message: "PDF cannot be parsed",
          });
        }),
      },
    });

    await expect(orchestrator.processContract(command)).rejects.toBeInstanceOf(
      PermanentContractProcessingError,
    );
    expect(processingRuns.run.status).toBe("FAILED");
    expect(processingRuns.run.errorRetryable).toBe(false);
    expect(auditEvents.at(-1)?.action).toBe("CONTRACT_PROCESSING_FAILED");
  });
});
