import { describe, expect, it, vi } from "vitest";

import { PermanentContractProcessingError, RetryableContractProcessingError } from "../../src/modules/contracts/contract-processing.errors.js";
import type { ContractProcessingOrchestrator } from "../../src/modules/contracts/contract-processing-orchestrator.service.js";
import { ContractProcessingProcessor } from "../../src/jobs/processors/contract-processing.processor.js";
import type { BackgroundJob } from "../../src/jobs/job.types.js";
import { PermanentJobError, RetryableJobError } from "../../src/jobs/retry-policy.js";

const payload = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  contractId: "00000000-0000-4000-8000-000000000002",
  documentId: "00000000-0000-4000-8000-000000000003",
  processingRunId: "00000000-0000-4000-8000-000000000004",
};

function job(overrides: Partial<BackgroundJob> = {}): BackgroundJob {
  return {
    id: "job-1",
    jobType: "PROCESS_CONTRACT",
    idempotencyKey: "contract:process:1",
    payload,
    status: "PROCESSING",
    priority: 0,
    availableAt: new Date(),
    attemptCount: 2,
    maxAttempts: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ContractProcessingProcessor", () => {
  it("validates payload and invokes the orchestration service", async () => {
    const processContract = vi.fn(async () => ({
      outcome: "CLAIMED_AND_COMPLETED" as const,
      status: "COMPLETED" as const,
    }));
    const processor = new ContractProcessingProcessor({
      processContract,
    } as unknown as ContractProcessingOrchestrator);

    await processor.process(job());

    expect(processContract).toHaveBeenCalledWith({
      ...payload,
      jobId: "job-1",
      queueJobId: "contract:process:1",
      attemptNumber: 2,
    });
  });

  it("rejects invalid payload before business processing", async () => {
    const processContract = vi.fn();
    const processor = new ContractProcessingProcessor({
      processContract,
    } as unknown as ContractProcessingOrchestrator);

    await expect(processor.process(job({ payload: { contractId: "bad" } }))).rejects.toBeInstanceOf(
      PermanentJobError,
    );
    expect(processContract).not.toHaveBeenCalled();
  });

  it("propagates retryable pipeline failures as retryable job errors", async () => {
    const processor = new ContractProcessingProcessor({
      processContract: vi.fn(async () => {
        throw new RetryableContractProcessingError({
          code: "STORAGE_TEMPORARY_UNAVAILABLE",
          stage: "DOCUMENT_LOAD",
          message: "Storage is temporarily unavailable",
        });
      }),
    } as unknown as ContractProcessingOrchestrator);

    await expect(processor.process(job())).rejects.toBeInstanceOf(RetryableJobError);
  });

  it("propagates permanent pipeline failures as permanent job errors", async () => {
    const processor = new ContractProcessingProcessor({
      processContract: vi.fn(async () => {
        throw new PermanentContractProcessingError({
          code: "INVALID_PDF",
          stage: "PARSE",
          message: "PDF cannot be parsed",
        });
      }),
    } as unknown as ContractProcessingOrchestrator);

    await expect(processor.process(job())).rejects.toBeInstanceOf(PermanentJobError);
  });
});
