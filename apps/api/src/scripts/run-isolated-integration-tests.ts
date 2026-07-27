import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import pg from "pg";

import { loadEnv } from "../config/env.js";

const env = loadEnv();
if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const files = [
  "tests/integration/job-repository.integration.test.ts",
  "tests/integration/contract-processing-repository.integration.test.ts",
  "tests/integration/reminder-delivery.integration.test.ts",
] as const;
const admin = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
});
const schemas: string[] = [];

function quotedIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function runTest(file: string, testDatabaseUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "corepack",
      ["pnpm", "exec", "vitest", "run", file],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TEST_DATABASE_URL: testDatabaseUrl,
          TEST_DATABASE_SSL: String(env.DATABASE_SSL),
        },
        shell: process.platform === "win32",
        stdio: "inherit",
      },
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${file} exited with code ${code ?? "unknown"}`));
    });
  });
}

await admin.connect();
const before = await admin.query(
  `SELECT
     (SELECT COUNT(*)::int FROM contracts) AS contracts,
     (SELECT COUNT(*)::int FROM contract_processing_runs) AS processing_runs,
     (SELECT COUNT(*)::int FROM background_jobs) AS background_jobs`,
);

try {
  for (const file of files) {
    const schema = `codex_integration_${randomUUID().replaceAll("-", "")}`;
    schemas.push(schema);
    await admin.query(`CREATE SCHEMA ${quotedIdentifier(schema)}`);
    const isolatedUrl = new URL(env.DATABASE_URL);
    isolatedUrl.searchParams.set("options", `-c search_path=${schema},public`);
    await runTest(file, isolatedUrl.toString());
  }
} finally {
  for (const schema of schemas.reverse()) {
    await admin.query(`DROP SCHEMA IF EXISTS ${quotedIdentifier(schema)} CASCADE`);
  }
  const after = await admin.query(
    `SELECT
       (SELECT COUNT(*)::int FROM contracts) AS contracts,
       (SELECT COUNT(*)::int FROM contract_processing_runs) AS processing_runs,
       (SELECT COUNT(*)::int FROM background_jobs) AS background_jobs`,
  );
  const remaining = await admin.query(
    `SELECT schema_name
       FROM information_schema.schemata
      WHERE schema_name LIKE 'codex_integration_%'`,
  );
  console.log(
    JSON.stringify(
      {
        applicationCountsBefore: before.rows[0],
        applicationCountsAfter: after.rows[0],
        temporarySchemasRemaining: remaining.rows,
      },
      null,
      2,
    ),
  );
  await admin.end();
}
