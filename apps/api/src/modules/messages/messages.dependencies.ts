/**
 * @file Defines backend messages module contracts, services, routes, or persistence logic.
 */
import { getApplicationDatabase } from "../../infrastructure/database/app-database.js";
import { PgTransactionManager } from "../../infrastructure/database/transaction-manager.js";
import { PostgresMessageRepository } from "./postgres-message.repository.js";

/**
 * @description Executes the create message dependencies operation used by the application workflow.
 * @returns {unknown} Result of the create message dependencies operation.
 */
export function createMessageDependencies() {
  const database = getApplicationDatabase();
  const transactions = new PgTransactionManager(database.pool);
  const messages = new PostgresMessageRepository(transactions);

  return {
    database,
    transactions,
    messages,
  };
}
