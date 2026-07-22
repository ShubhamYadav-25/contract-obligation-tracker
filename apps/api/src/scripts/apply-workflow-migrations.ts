import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";

const workflowMigrationFiles = [
  "202607210004_document_text_segmentation.up.sql",
  "202607220001_obligations.up.sql",
  "202607220002_extraction_candidates.up.sql",
  "202607220003_extraction_candidates_status.up.sql",
] as const;

async function main(): Promise<void> {
  const database = new PgPoolClient(createDatabaseConfig(loadEnv()));
  const migrationsDirectory = resolve(process.cwd(), "../../packages/database/migrations");

  try {
    for (const filename of workflowMigrationFiles) {
      const sql = await readFile(resolve(migrationsDirectory, filename), "utf8");
      await database.query(sql);
      console.log("workflow_migration_applied", { filename });
    }
  } finally {
    await database.close();
  }
}

main().catch((error) => {
  console.error("workflow_migration_failed", error);
  process.exitCode = 1;
});
