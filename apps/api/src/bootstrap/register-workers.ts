import type { Logger } from "../config/logger.js";
import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { createJobConfig } from "../config/jobs.js";
import type { CloseableResource } from "./graceful-shutdown.js";
import { SystemClock } from "../infrastructure/clock/clock.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../infrastructure/database/transaction-manager.js";
import { ContractProcessingOrchestrator } from "../modules/contracts/contract-processing-orchestrator.service.js";
import { PipelineNotConfigured } from "../modules/contracts/contract-processing.pipeline.js";
import { PostgresAuditRepository } from "../modules/audit/postgres-audit.repository.js";
import {
  PostgresContractProcessingRepository,
} from "../modules/contracts/postgres-contract.repository.js";
import { JobRepository, PostgresJobRepository } from "../jobs/job.repository.js";
import { JobRunner } from "../jobs/job-runner.js";
import { JobPoller } from "../jobs/pollers/job-poller.js";
import { PollingLoop } from "../jobs/pollers/polling-loop.js";
import { ContractProcessingProcessor } from "../jobs/processors/contract-processing.processor.js";
import { ProcessorRegistry } from "../jobs/processors/processor-registry.js";
import { ReminderDeliveryProcessor } from "../jobs/processors/reminder-delivery.processor.js";

export interface WorkerRegistry extends CloseableResource {
  readonly names: readonly string[];
}

export interface WorkerRuntime extends CloseableResource {
  readonly names: readonly string[];
  start(): void;
}

export function createWorkerRuntime({ logger }: { readonly logger: Logger }): WorkerRuntime {
  const env = loadEnv();
  const jobConfig = createJobConfig(env);
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const jobs: JobRepository = new PostgresJobRepository(database, transactions);
  const orchestrator = new ContractProcessingOrchestrator({
    processingRuns: new PostgresContractProcessingRepository(database),
    audit: new PostgresAuditRepository(database),
    transactions,
    pipeline: new PipelineNotConfigured(),
    logger,
  });
  const contractProcessor = new ContractProcessingProcessor(orchestrator);
  const reminderProcessor = new ReminderDeliveryProcessor();
  const registry = new ProcessorRegistry(
    new Map([
      ["PROCESS_CONTRACT", (job) => contractProcessor.process(job)],
      ["DELIVER_REMINDER", (job) => reminderProcessor.process(job)],
    ]),
  );
  const runner = new JobRunner(jobs, registry, jobConfig, new SystemClock(), logger);
  const pollingLoop = new PollingLoop(
    new JobPoller(runner),
    jobConfig.pollIntervalMilliseconds,
    logger,
  );
  const names = ["PROCESS_CONTRACT"] as const;

  return {
    names,
    start() {
      pollingLoop.start();
      logger.info("workers_registered", { workers: names });
    },
    async close() {
      pollingLoop.close();
      await database.close();
      logger.info("workers_closed");
    },
  };
}

export function registerWorkers({
  createRuntime = createWorkerRuntime,
  logger,
}: {
  readonly logger: Logger;
  readonly createRuntime?: (input: { readonly logger: Logger }) => WorkerRuntime;
}): WorkerRegistry {
  const runtime = createRuntime({ logger });
  runtime.start();
  return runtime;
}
