import { createDatabaseConfig } from "../../config/database.js";
import { loadEnv } from "../../config/env.js";
import { PgPoolClient } from "../../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../../infrastructure/database/transaction-manager.js";
import { PostgresReminderRepository } from "./postgres-reminder.repository.js";

export function createReminderDependencies() {
  const env = loadEnv();
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const reminders = new PostgresReminderRepository(transactions);

  return {
    database,
    transactions,
    reminders,
  };
}
