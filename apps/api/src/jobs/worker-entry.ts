import { pathToFileURL } from "node:url";

import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { createJobConfig } from "../config/jobs.js";
import { createLogger } from "../config/logger.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../infrastructure/database/transaction-manager.js";
import { SystemClock } from "../infrastructure/clock/clock.js";
import { createGracefulShutdown } from "../bootstrap/graceful-shutdown.js";
import { JobRepository, PostgresJobRepository } from "./job.repository.js";
import { JobRunner } from "./job-runner.js";
import { JobPoller } from "./pollers/job-poller.js";
import { PollingLoop } from "./pollers/polling-loop.js";
import { ContractProcessingProcessor } from "./processors/contract-processing.processor.js";
import { ProcessorRegistry } from "./processors/processor-registry.js";
import { ReminderDeliveryProcessor } from "./processors/reminder-delivery.processor.js";

export function createWorkerRuntime() {
  const env = loadEnv();
  const logger = createLogger(env);
  const jobConfig = createJobConfig(env);
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const jobRepository: JobRepository = new PostgresJobRepository(database, transactions);
  const contractProcessor = new ContractProcessingProcessor();
  const reminderProcessor = new ReminderDeliveryProcessor();
  const registry = new ProcessorRegistry(
    new Map([
      ["PROCESS_CONTRACT", (job) => contractProcessor.process(job)],
      ["DELIVER_REMINDER", (job) => reminderProcessor.process(job)],
    ]),
  );
  const runner = new JobRunner(jobRepository, registry, jobConfig, new SystemClock(), logger);
  const pollingLoop = new PollingLoop(
    new JobPoller(runner),
    jobConfig.pollIntervalMilliseconds,
    logger,
  );
  const shutdown = createGracefulShutdown({ logger, resources: [database, pollingLoop] });

  return { pollingLoop, shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runtime = createWorkerRuntime();
  runtime.pollingLoop.start();

  process.on("SIGINT", () => {
    void runtime.shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void runtime.shutdown("SIGTERM");
  });
}
