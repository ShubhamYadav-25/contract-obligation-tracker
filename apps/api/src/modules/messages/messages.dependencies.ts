/**
 * @file Defines backend messages module contracts, services, routes, or persistence logic.
 */
import { createDatabaseConfig } from "../../config/database.js";
import { loadEnv } from "../../config/env.js";
import { PgPoolClient } from "../../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../../infrastructure/database/transaction-manager.js";
import { PostgresMessageRepository } from "./postgres-message.repository.js";

/**
 * @description Executes the create message dependencies operation used by the application workflow.
 * @returns {unknown} Result of the create message dependencies operation.
 */
export function createMessageDependencies() {
  const env = loadEnv();
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const messages = new PostgresMessageRepository(transactions);

  return {
    database,
    transactions,
    messages,
  };
}
