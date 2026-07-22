import { createDatabaseConfig } from "../../config/database.js";
import { loadEnv } from "../../config/env.js";
import { PgPoolClient } from "../../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../../infrastructure/database/transaction-manager.js";
import { PostgresObligationRepository } from "./postgres-obligation.repository.js";
import { PostgresTransitionHistoryRepository } from "./postgres-transition-history.repository.js";
import { ObligationService } from "./obligations.service.js";
import { SystemClock } from "../../infrastructure/clock/clock.js";

export function createObligationServiceDependencies() {
  const env = loadEnv();
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const obligations = new PostgresObligationRepository(transactions);
  const transitionHistory = new PostgresTransitionHistoryRepository(transactions);
  const service = new ObligationService(obligations, transitionHistory, new SystemClock());

  return {
    database,
    transactions,
    obligations,
    transitionHistory,
    service,
  };
}
