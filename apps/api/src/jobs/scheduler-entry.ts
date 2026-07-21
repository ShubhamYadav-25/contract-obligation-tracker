import { pathToFileURL } from "node:url";

import cron from "node-cron";

import { createGracefulShutdown } from "../bootstrap/graceful-shutdown.js";
import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { createJobConfig } from "../config/jobs.js";
import { createLogger } from "../config/logger.js";
import { createSchedulerConfig } from "../config/scheduler.js";
import { SystemClock } from "../infrastructure/clock/clock.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../infrastructure/database/transaction-manager.js";
import { PostgresReminderSchedulerRepository } from "../modules/reminders/postgres-reminder-scheduler.repository.js";
import { ReminderPoller } from "./schedulers/reminder-poller.js";

export function createSchedulerRuntime() {
  const env = loadEnv();
  const logger = createLogger(env);
  const schedulerConfig = createSchedulerConfig(env);
  const jobConfig = createJobConfig(env);
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const poller = new ReminderPoller(
    new PostgresReminderSchedulerRepository(transactions),
    new SystemClock(),
    schedulerConfig.reminderLookaheadMinutes,
  );

  const task = cron.schedule(
    schedulerConfig.cronExpression,
    () => {
      void poller.pollDueReminders(jobConfig.batchSize).catch((error: unknown) => {
        logger.error("reminder_scheduler_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      });
    },
    { timezone: schedulerConfig.timezone },
  );

  const schedulerResource = {
    close() {
      task.stop();
    },
  };

  return {
    task,
    shutdown: createGracefulShutdown({ logger, resources: [database, schedulerResource] }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runtime = createSchedulerRuntime();

  process.on("SIGINT", () => {
    void runtime.shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void runtime.shutdown("SIGTERM");
  });
}
