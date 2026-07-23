import type { Logger } from "../config/logger.js";
import { createJobConfig } from "../config/jobs.js";
import { createSchedulerConfig } from "../config/scheduler.js";
import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { SystemClock } from "../infrastructure/clock/clock.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../infrastructure/database/transaction-manager.js";
import { ReminderPoller } from "../jobs/schedulers/reminder-poller.js";
import { PostgresReminderSchedulerRepository } from "../modules/reminders/postgres-reminder-scheduler.repository.js";
import type { CloseableResource } from "./graceful-shutdown.js";

export interface SchedulerRegistry extends CloseableResource {
  readonly names: readonly string[];
}

export interface SchedulerRuntime extends SchedulerRegistry {
  start(): void;
  runOnce(): Promise<number>;
}

export function createReminderSchedulerRuntime({
  logger,
}: {
  readonly logger: Logger;
}): SchedulerRuntime {
  const env = loadEnv();
  const jobConfig = createJobConfig(env);
  const schedulerConfig = createSchedulerConfig(env);
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const poller = new ReminderPoller(
    new PostgresReminderSchedulerRepository(transactions),
    new SystemClock(),
    schedulerConfig.reminderLookaheadMinutes,
  );
  const names = ["REMINDER_SCHEDULER"] as const;
  let timer: NodeJS.Timeout | undefined;

  async function poll(): Promise<number> {
    return poller.pollDueReminders(jobConfig.batchSize);
  }

  return {
    names,
    start() {
      void poll().catch((error: unknown) => {
        logger.error("reminder_scheduler_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      });
      timer = setInterval(() => {
        void poll().catch((error: unknown) => {
          logger.error("reminder_scheduler_failed", {
            message: error instanceof Error ? error.message : String(error),
          });
        });
      }, jobConfig.pollIntervalMilliseconds);
      logger.info("schedulers_registered", { schedulers: names });
    },
    runOnce: poll,
    async close() {
      if (timer) {
        clearInterval(timer);
      }
      await database.close();
      logger.info("schedulers_closed");
    },
  };
}

export function registerSchedulers({
  createRuntime = createReminderSchedulerRuntime,
  logger,
}: {
  readonly logger: Logger;
  readonly createRuntime?: (input: { readonly logger: Logger }) => SchedulerRuntime;
}): SchedulerRegistry {
  const runtime = createRuntime({ logger });
  runtime.start();
  return runtime;
}
