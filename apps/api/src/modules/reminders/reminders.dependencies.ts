/**
 * @file Defines backend reminders module contracts, services, routes, or persistence logic.
 */
import { getApplicationDatabase } from "../../infrastructure/database/app-database.js";
import { PgTransactionManager } from "../../infrastructure/database/transaction-manager.js";
import { PostgresReminderRepository } from "./postgres-reminder.repository.js";

/**
 * @description Executes the create reminder dependencies operation used by the application workflow.
 * @returns {unknown} Result of the create reminder dependencies operation.
 */
export function createReminderDependencies() {
  const database = getApplicationDatabase();
  const transactions = new PgTransactionManager(database.pool);
  const reminders = new PostgresReminderRepository(transactions);

  return {
    database,
    transactions,
    reminders,
  };
}
