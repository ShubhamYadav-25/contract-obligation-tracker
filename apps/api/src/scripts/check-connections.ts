import { createClient } from "@supabase/supabase-js";
import pg from "pg";

import { createDatabaseConfig } from "../config/database.js";
import { loadDotEnvFile } from "../config/dotenv.js";
import { loadEnv } from "../config/env.js";

const { Pool } = pg;

interface CheckError {
  readonly name: string;
  readonly code?: string;
  readonly message: string;
}

interface CheckResult {
  readonly ok: boolean;
  readonly details?: Record<string, unknown>;
  readonly error?: CheckError;
}

function cleanError(error: unknown): CheckError {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    ...(typeof error === "object" && error !== null && "code" in error
      ? { code: String(error.code) }
      : {}),
    message: error instanceof Error ? error.message : String(error),
  };
}

async function checkDatabase(): Promise<CheckResult> {
  const env = loadEnv();
  const database = createDatabaseConfig(env);
  const pool = new Pool({
    connectionString: database.connectionString,
    max: 1,
    connectionTimeoutMillis: database.connectionTimeoutMilliseconds,
    idleTimeoutMillis: database.idleTimeoutMilliseconds,
    ssl: database.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    const result = await pool.query<{
      readonly database_name: string;
      readonly schema_name: string;
      readonly server_time: Date;
      readonly background_jobs_table: string | null;
    }>(`
      SELECT
        current_database() AS database_name,
        current_schema() AS schema_name,
        now() AS server_time,
        to_regclass('public.background_jobs') AS background_jobs_table
    `);

    const row = result.rows[0];
    return {
      ok: true,
      details: {
        databaseName: row?.database_name,
        schemaName: row?.schema_name,
        serverTimeAvailable: Boolean(row?.server_time),
        backgroundJobsTableExists: Boolean(row?.background_jobs_table),
      },
    };
  } catch (error) {
    return { ok: false, error: cleanError(error) };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function checkSupabaseStorage(): Promise<CheckResult> {
  const env = loadEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      error: {
        name: "ConfigurationError",
        message: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing",
      },
    };
  }

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const buckets = await supabase.storage.listBuckets();
    if (buckets.error) {
      throw new Error(buckets.error.message);
    }

    const bucket = buckets.data.find((item) => item.name === env.SUPABASE_STORAGE_BUCKET);
    if (!bucket) {
      return {
        ok: false,
        details: {
          supabaseStorageApiReachable: true,
          configuredBucket: env.SUPABASE_STORAGE_BUCKET,
          configuredBucketExists: false,
          availableBucketCount: buckets.data.length,
        },
        error: {
          name: "ConfigurationError",
          message: "Configured Supabase Storage bucket was not found",
        },
      };
    }

    return {
      ok: true,
      details: {
        supabaseStorageApiReachable: true,
        bucket: bucket.name,
        isPublic: bucket.public,
      },
    };
  } catch (error) {
    return { ok: false, error: cleanError(error) };
  }
}

async function main(): Promise<void> {
  loadDotEnvFile();

  const env = loadEnv();
  const results = {
    config: {
      ok: true,
      details: {
        nodeEnv: env.NODE_ENV,
        storageProvider: env.STORAGE_PROVIDER,
        emailProvider: env.EMAIL_PROVIDER,
        hasDatabaseUrl: Boolean(env.DATABASE_URL),
        hasSupabaseUrl: Boolean(env.SUPABASE_URL),
        hasSupabaseServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      },
    },
    database: await checkDatabase(),
    storage: await checkSupabaseStorage(),
  };

  console.log(JSON.stringify(results, null, 2));

  if (!results.database.ok || !results.storage.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify(
      {
        config: { ok: false, error: cleanError(error) },
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
