import { createDatabaseConfig } from "../../config/database.js";
import { loadEnv } from "../../config/env.js";
import { PgPoolClient } from "./postgres-client.js";

let applicationDatabase: PgPoolClient | null = null;

/**
 * Returns the single PostgreSQL pool owned by the API process.
 * Workers and schedulers run in separate processes and retain their own pools.
 */
export function getApplicationDatabase(): PgPoolClient {
  applicationDatabase ??= new PgPoolClient(createDatabaseConfig(loadEnv()));
  return applicationDatabase;
}

export async function closeApplicationDatabase(): Promise<void> {
  const database = applicationDatabase;
  applicationDatabase = null;
  await database?.close();
}
