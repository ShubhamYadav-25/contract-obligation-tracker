import type { Logger } from "../../config/logger.js";
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { AuditRepository } from "../audit/audit.repository.js";
import type { ProcessContractJobPayload } from "./contract-processing-job.schema.js";
import type { ContractProcessingPipeline } from "./contract-processing.pipeline.js";
import { toProcessingFailure } from "./contract-processing.errors.js";
import type {
  ContractProcessingRepository,
  FailContractProcessingRunInput,
} from "./contracts.repository.js";
import type { ContractProcessingRunStatus } from "./contracts.types.js";

export type ContractProcessingOrchestrationResult =
  | {
      readonly outcome: "CLAIMED_AND_COMPLETED";
      readonly status: "COMPLETED" | "TEXT_SEGMENTED";
    }
  | { readonly outcome: "CLAIMED_AND_REVIEW_REQUIRED"; readonly status: "REVIEW_REQUIRED" }
  | {
      readonly outcome: "NO_OP";
      readonly status: ContractProcessingRunStatus | "NOT_FOUND";
      readonly reason: "NOT_FOUND" | "ALREADY_TERMINAL" | "NOT_PROCESSABLE";
    };

export interface ProcessContractCommand extends ProcessContractJobPayload {
  readonly jobId: string;
  readonly queueJobId: string;
  readonly attemptNumber: number;
}

export interface ContractProcessingOrchestratorDependencies {
  readonly processingRuns: ContractProcessingRepository;
  readonly audit: AuditRepository;
  readonly transactions: TransactionManager;
  readonly pipeline: ContractProcessingPipeline;
  readonly logger: Logger;
}

const terminalStatuses = new Set<ContractProcessingRunStatus>([
  "TEXT_SEGMENTED",
  "COMPLETED",
  "REVIEW_REQUIRED",
  "FAILED",
]);

function safeMessage(message: string): string {
  return message.slice(0, 1_000);
}

export class ContractProcessingOrchestrator {
  constructor(private readonly dependencies: ContractProcessingOrchestratorDependencies) {}

  async processContract(
    command: ProcessContractCommand,
  ): Promise<ContractProcessingOrchestrationResult> {
    const startedAt = Date.now();
    const logContext = {
      jobId: command.jobId,
      processingRunId: command.processingRunId,
      contractId: command.contractId,
      documentId: command.documentId,
      attemptNumber: command.attemptNumber,
    };

    const claimed = await this.dependencies.transactions.inTransaction(async (transaction) => {
      const run = await this.dependencies.processingRuns.claimForProcessing(
        {
          organizationId: command.organizationId,
          contractId: command.contractId,
          documentId: command.documentId,
          processingRunId: command.processingRunId,
          queueJobId: command.queueJobId,
          attemptNumber: command.attemptNumber,
        },
        transaction,
      );

      if (!run) {
        return null;
      }

      await this.dependencies.audit.append(
        {
          actor: { id: "contract-processing-worker", type: "SYSTEM" },
          action: "CONTRACT_PROCESSING_STARTED",
          entityType: "CONTRACT",
          entityId: command.contractId,
          newData: {
            documentId: command.documentId,
            processingRunId: command.processingRunId,
            attemptNumber: command.attemptNumber,
          },
          correlationId: command.jobId,
          timestamp: new Date(),
        },
        transaction,
      );

      return run;
    });

    if (!claimed) {
      const currentRun = await this.dependencies.processingRuns.findById({
        organizationId: command.organizationId,
        processingRunId: command.processingRunId,
      });
      const status = currentRun?.status ?? "NOT_FOUND";
      const reason = !currentRun
        ? "NOT_FOUND"
        : terminalStatuses.has(currentRun.status)
          ? "ALREADY_TERMINAL"
          : "NOT_PROCESSABLE";

      this.dependencies.logger.info("contract_processing_noop", {
        ...logContext,
        status,
        reason,
      });

      return { outcome: "NO_OP", status, reason };
    }

    this.dependencies.logger.info("contract_processing_started", {
      ...logContext,
      processingStage: "PIPELINE",
    });

    try {
      const result = await this.dependencies.pipeline.run({
        organizationId: command.organizationId,
        contractId: command.contractId,
        documentId: command.documentId,
        processingRunId: command.processingRunId,
      });

      if (result.outcome === "TEXT_SEGMENTED") {
        this.dependencies.logger.info("contract_processing_text_segmented", {
          ...logContext,
          processingStage: "PIPELINE",
          durationMilliseconds: Date.now() - startedAt,
          outcome: "TEXT_SEGMENTED",
          summary: result.summary ?? {},
        });

        return { outcome: "CLAIMED_AND_COMPLETED", status: "TEXT_SEGMENTED" };
      }

      if (result.outcome === "REVIEW_REQUIRED") {
        await this.dependencies.transactions.inTransaction(async (transaction) => {
          await this.dependencies.processingRuns.markReviewRequired(command, transaction);
          await this.dependencies.audit.append(
            {
              actor: { id: "contract-processing-worker", type: "SYSTEM" },
              action: "CONTRACT_PROCESSING_REVIEW_REQUIRED",
              entityType: "CONTRACT",
              entityId: command.contractId,
              newData: {
                documentId: command.documentId,
                processingRunId: command.processingRunId,
                reviewItemCount: result.reviewItemCount,
                summary: result.summary ?? {},
              },
              correlationId: command.jobId,
              timestamp: new Date(),
            },
            transaction,
          );
        });

        this.dependencies.logger.info("contract_processing_review_required", {
          ...logContext,
          processingStage: "PIPELINE",
          durationMilliseconds: Date.now() - startedAt,
          outcome: "REVIEW_REQUIRED",
        });

        return { outcome: "CLAIMED_AND_REVIEW_REQUIRED", status: "REVIEW_REQUIRED" };
      }

      await this.dependencies.transactions.inTransaction(async (transaction) => {
        await this.dependencies.processingRuns.markCompleted(command, transaction);
        await this.dependencies.audit.append(
          {
            actor: { id: "contract-processing-worker", type: "SYSTEM" },
            action: "CONTRACT_PROCESSING_COMPLETED",
            entityType: "CONTRACT",
            entityId: command.contractId,
            newData: {
              documentId: command.documentId,
              processingRunId: command.processingRunId,
              summary: result.summary ?? {},
            },
            correlationId: command.jobId,
            timestamp: new Date(),
          },
          transaction,
        );
      });

      this.dependencies.logger.info("contract_processing_completed", {
        ...logContext,
        processingStage: "PIPELINE",
        durationMilliseconds: Date.now() - startedAt,
        outcome: "COMPLETED",
      });

      return { outcome: "CLAIMED_AND_COMPLETED", status: "COMPLETED" };
    } catch (error) {
      const failure = toProcessingFailure(error);
      const failureInput: FailContractProcessingRunInput = {
        organizationId: command.organizationId,
        contractId: command.contractId,
        documentId: command.documentId,
        processingRunId: command.processingRunId,
        errorCode: failure.code,
        errorStage: failure.stage,
        retryable: failure.retryable,
        message: safeMessage(failure.message),
      };

      await this.dependencies.transactions.inTransaction(async (transaction) => {
        if (failure.retryable) {
          await this.dependencies.processingRuns.markRetryableFailure(failureInput, transaction);
        } else {
          await this.dependencies.processingRuns.markFailed(failureInput, transaction);
        }

        await this.dependencies.audit.append(
          {
            actor: { id: "contract-processing-worker", type: "SYSTEM" },
            action: "CONTRACT_PROCESSING_FAILED",
            entityType: "CONTRACT",
            entityId: command.contractId,
            newData: {
              documentId: command.documentId,
              processingRunId: command.processingRunId,
              errorCode: failure.code,
              errorStage: failure.stage,
              retryable: failure.retryable,
              message: safeMessage(failure.message),
            },
            correlationId: command.jobId,
            timestamp: new Date(),
          },
          transaction,
        );
      });

      this.dependencies.logger.warn("contract_processing_failed", {
        ...logContext,
        processingStage: failure.stage,
        durationMilliseconds: Date.now() - startedAt,
        outcome: "FAILED",
        retryable: failure.retryable,
        errorCode: failure.code,
        message: safeMessage(failure.message),
      });

      throw error;
    }
  }
}
