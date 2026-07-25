/**
 * @file Defines a backend operational script for local maintenance or diagnostics.
 */
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";

type MigrationPredicate = (database: PgPoolClient) => Promise<boolean>;

interface DeploymentMigration {
  readonly filename: string;
  readonly shouldApply?: MigrationPredicate;
}

const migrationsProbeFilename = "202607200001_supabase_postgres_jobs.up.sql";

/**
 * @description Checks whether a PostgreSQL table exists in the public schema.
 * @param {PgPoolClient} database - Database client.
 * @param {string} tableName - Table name to check.
 * @returns {Promise<boolean>} Whether the table exists.
 */
async function tableExists(database: PgPoolClient, tableName: string): Promise<boolean> {
  const result = await database.query<{ readonly table_exists: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS table_exists",
    [`public.${tableName}`],
  );
  return result.rows[0]?.table_exists ?? false;
}

/**
 * @description Checks whether a PostgreSQL table column exists in the public schema.
 * @param {PgPoolClient} database - Database client.
 * @param {string} tableName - Table name to check.
 * @param {string} columnName - Column name to check.
 * @returns {Promise<boolean>} Whether the column exists.
 */
async function columnExists(
  database: PgPoolClient,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await database.query<{ readonly column_exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS column_exists`,
    [tableName, columnName],
  );
  return result.rows[0]?.column_exists ?? false;
}

const deploymentMigrationFiles: readonly DeploymentMigration[] = [
  {
    filename: migrationsProbeFilename,
    shouldApply: async (database) =>
      !(await tableExists(database, "background_jobs")) ||
      !(await tableExists(database, "reminders")) ||
      !(await tableExists(database, "audit_events")),
  },
  {
    filename: "202607210001_contract_ingestion.up.sql",
    shouldApply: async (database) =>
      !(await tableExists(database, "contracts")) ||
      !(await tableExists(database, "contract_documents")) ||
      !(await tableExists(database, "contract_processing_runs")),
  },
  {
    filename: "202607210002_contract_processing_lifecycle.up.sql",
    shouldApply: async (database) =>
      (await tableExists(database, "contract_processing_runs")) &&
      !(await columnExists(database, "contract_processing_runs", "error_stage")),
  },
  {
    filename: "202607210003_contract_document_upload_lifecycle.up.sql",
    shouldApply: async (database) =>
      (await tableExists(database, "contract_documents")) &&
      !(await columnExists(database, "contract_documents", "upload_status")),
  },
  {
    filename: "202607210004_document_text_segmentation.up.sql",
    shouldApply: async (database) => !(await tableExists(database, "document_text_pages")),
  },
  {
    filename: "202607220001_obligations.up.sql",
    shouldApply: async (database) => !(await tableExists(database, "obligations")),
  },
  {
    filename: "202607220002_extraction_candidates.up.sql",
    shouldApply: async (database) => !(await tableExists(database, "extraction_candidates")),
  },
  {
    filename: "202607220003_extraction_candidates_status.up.sql",
    shouldApply: async (database) =>
      (await tableExists(database, "extraction_candidates")) &&
      !(await columnExists(database, "extraction_candidates", "status")),
  },
  {
    filename: "202607220004_inbox_entries.up.sql",
    shouldApply: async (database) => !(await tableExists(database, "inbox_entries")),
  },
];

const migrationsRelativePath = "packages/database/migrations";

/**
 * @description Checks whether a filesystem path is readable.
 * @param {string} path - Path to check.
 * @returns {Promise<boolean>} Whether the path can be accessed.
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * @description Resolves the database migrations directory across local and compiled Render start contexts.
 * @returns {Promise<string>} Absolute migrations directory path.
 */
export async function resolveMigrationsDirectory(): Promise<string> {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), migrationsRelativePath),
    resolve(process.cwd(), "../..", migrationsRelativePath),
  ];

  let currentDirectory = moduleDirectory;
  for (let depth = 0; depth < 8; depth += 1) {
    candidates.push(resolve(currentDirectory, migrationsRelativePath));

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }

  for (const candidate of candidates) {
    if (await pathExists(resolve(candidate, migrationsProbeFilename))) {
      return candidate;
    }
  }

  throw new Error(`Unable to locate database migrations directory. Checked: ${candidates.join(", ")}`);
}

/**
 * @description Runs the main script step for local operations.
 * @returns {Promise<void>} Result of the main operation.
 */
async function main(): Promise<void> {
  const database = new PgPoolClient(createDatabaseConfig(loadEnv()));
  const migrationsDirectory = await resolveMigrationsDirectory();

  try {
    for (const migration of deploymentMigrationFiles) {
      if (migration.shouldApply && !(await migration.shouldApply(database))) {
        console.log("workflow_migration_skipped", { filename: migration.filename });
        continue;
      }

      const sql = await readFile(resolve(migrationsDirectory, migration.filename), "utf8");
      await database.query(sql);
      console.log("workflow_migration_applied", { filename: migration.filename });
    }
  } finally {
    await database.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("workflow_migration_failed", error);
    process.exitCode = 1;
  });
}
