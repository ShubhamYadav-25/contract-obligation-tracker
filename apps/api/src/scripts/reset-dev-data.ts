import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { createLogger } from "../config/logger.js";
import { createStorageConfig } from "../config/storage.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../infrastructure/database/transaction-manager.js";
import { SupabaseStorageProvider } from "../infrastructure/storage/supabase-storage.provider.js";
import { PostgresJobRepository } from "../jobs/job.repository.js";
import { ContractProcessingProducer } from "../jobs/producers/contract-processing.producer.js";
import { PostgresAuditRepository } from "../modules/audit/postgres-audit.repository.js";
import { ContractIngestionService } from "../modules/contracts/contract-ingestion.service.js";
import { parseCuadManifest, resolveWorkingSubsetPath } from "../modules/contracts/cuad-manifest.js";
import { FileHashService } from "../modules/contracts/file-hash.service.js";
import {
  PostgresContractDocumentRepository,
  PostgresContractProcessingRepository,
  PostgresContractRepository,
  PostgresDocumentTextPageRepository,
} from "../modules/contracts/postgres-contract.repository.js";
import { PostgresExtractionCandidateRepository } from "../modules/extraction/postgres-extraction.repository.js";
import { ObligationService } from "../modules/obligations/obligations.service.js";
import { PostgresObligationRepository } from "../modules/obligations/postgres-obligation.repository.js";
import { PostgresTransitionHistoryRepository } from "../modules/obligations/postgres-transition-history.repository.js";
import type {
  ObligationRecord,
  ObligationStatus,
} from "../modules/obligations/obligations.types.js";
import { createReminderOccurrenceKey } from "../modules/reminders/reminder-occurrence-key.js";

const resetConfirmation = "truncate-postgres-and-storage";
const applicationTables = [
  "inbox_entries",
  "reminder_delivery_attempts",
  "reminders",
  "obligation_transition_history",
  "obligations",
  "extraction_candidates",
  "document_text_pages",
  "contract_processing_runs",
  "contract_documents",
  "contracts",
  "background_jobs",
  "audit_events",
] as const;

interface Runtime {
  readonly database: PgPoolClient;
  readonly transactions: PgTransactionManager;
  readonly ingestion: ContractIngestionService;
  readonly textPages: PostgresDocumentTextPageRepository;
  readonly obligations: PostgresObligationRepository;
  readonly obligationService: ObligationService;
  readonly extractionCandidates: PostgresExtractionCandidateRepository;
  readonly audit: PostgresAuditRepository;
}

interface ContractFixture {
  readonly id: string;
  readonly sampleText: string;
  readonly expected: {
    readonly contractValue: number;
    readonly termMonths: number;
    readonly renewalTerms: string;
    readonly noticePeriodDays: number;
  };
}

interface SeededContract {
  readonly contractId: string;
  readonly documentId: string;
  readonly processingRunId: string;
  readonly displayName: string;
  readonly sampleText: string;
}

function requireResetConfirmation(): void {
  if (process.env.CONFIRM_DEV_DATA_RESET !== resetConfirmation) {
    throw new Error(
      `Refusing to reset data. Set CONFIRM_DEV_DATA_RESET=${resetConfirmation} to continue.`,
    );
  }
}

function parseSeedLimit(): number {
  const parsed = Number.parseInt(process.env.SEED_CONTRACT_LIMIT ?? "5", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 5;
  }
  return Math.min(parsed, 25);
}

function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function createRuntime(): Runtime {
  const env = loadEnv();
  if (env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_RESET !== "true") {
    throw new Error("Refusing to reset data while NODE_ENV=production.");
  }

  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const logger = createLogger(env);
  const storageConfig = createStorageConfig(env);
  const jobs = new PostgresJobRepository(database, transactions);
  const contracts = new PostgresContractRepository(database);
  const textPages = new PostgresDocumentTextPageRepository(database);
  const obligations = new PostgresObligationRepository(transactions);
  const audit = new PostgresAuditRepository(database);

  return {
    database,
    transactions,
    ingestion: new ContractIngestionService({
      contracts,
      contractReads: contracts,
      documents: new PostgresContractDocumentRepository(database),
      documentTextPages: textPages,
      processingRuns: new PostgresContractProcessingRepository(database),
      processingQueue: new ContractProcessingProducer(jobs),
      audit,
      storage: new SupabaseStorageProvider(storageConfig),
      storageMetadata: {
        provider: "supabase",
        bucket: storageConfig.bucket,
      },
      fileHash: new FileHashService(),
      transactions,
      validation: {
        maxFileSizeBytes: env.CONTRACT_MAX_FILE_SIZE_MB * 1024 * 1024,
        maxPageCount: env.CONTRACT_MAX_PAGE_COUNT,
      },
      logger,
    }),
    textPages,
    obligations,
    obligationService: new ObligationService(
      obligations,
      new PostgresTransitionHistoryRepository(transactions),
      { now: () => new Date() },
    ),
    extractionCandidates: new PostgresExtractionCandidateRepository(transactions),
    audit,
  };
}

async function readFixtures(repositoryRoot: string): Promise<readonly ContractFixture[]> {
  const fixturesPath = resolve(repositoryRoot, "datasets/contracts/25_contracts.jsonl");
  if (!existsSync(fixturesPath)) {
    return [];
  }

  const content = await readFile(fixturesPath, "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ContractFixture);
}

async function listStorageObjectKeys(input: {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
  readonly bucket: string;
  readonly prefix?: string;
}): Promise<readonly string[]> {
  const client = createClient(input.supabaseUrl, input.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const objectKeys: string[] = [];
  const pageSize = 100;
  let offset = 0;

  for (;;) {
    const result = await client.storage.from(input.bucket).list(input.prefix ?? "", {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (result.error) {
      throw new Error(`Supabase Storage list failed: ${result.error.message}`);
    }
    const entries = result.data ?? [];
    if (entries.length === 0) {
      break;
    }

    for (const entry of entries) {
      const objectKey = input.prefix ? `${input.prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        objectKeys.push(
          ...(await listStorageObjectKeys({
            supabaseUrl: input.supabaseUrl,
            serviceRoleKey: input.serviceRoleKey,
            bucket: input.bucket,
            prefix: objectKey,
          })),
        );
      } else {
        objectKeys.push(objectKey);
      }
    }

    if (entries.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return objectKeys;
}

async function truncateStorageBucket(): Promise<number> {
  const env = loadEnv();
  if (env.STORAGE_PROVIDER !== "supabase") {
    console.log("storage_reset_skipped", { provider: env.STORAGE_PROVIDER });
    return 0;
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to reset storage.");
  }

  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const objectKeys = await listStorageObjectKeys({
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    bucket,
  });

  for (let index = 0; index < objectKeys.length; index += 100) {
    const batch = objectKeys.slice(index, index + 100);
    const result = await client.storage.from(bucket).remove(batch);
    if (result.error) {
      throw new Error(`Supabase Storage remove failed: ${result.error.message}`);
    }
  }

  return objectKeys.length;
}

async function truncateDatabase(database: PgPoolClient): Promise<readonly string[]> {
  const tableResult = await database.query<{ readonly table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY array_position($1::text[], table_name)
    `,
    [applicationTables],
  );
  const existingTables = tableResult.rows.map((row) => row.table_name);
  if (existingTables.length === 0) {
    return [];
  }

  await database.query(
    `TRUNCATE TABLE ${existingTables.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
  return existingTables;
}

async function applyRequiredMigrations(input: {
  readonly database: PgPoolClient;
  readonly repositoryRoot: string;
}): Promise<readonly string[]> {
  const migrationsDirectory = resolve(input.repositoryRoot, "packages/database/migrations");
  const requiredMigrations = [
    {
      tableName: "inbox_entries",
      filename: "202607220004_inbox_entries.up.sql",
    },
  ] as const;
  const appliedMigrations: string[] = [];

  for (const migration of requiredMigrations) {
    const tableResult = await input.database.query<{ readonly table_exists: string | null }>(
      "SELECT to_regclass($1) AS table_exists",
      [`public.${migration.tableName}`],
    );
    if (tableResult.rows[0]?.table_exists) {
      continue;
    }

    const sql = await readFile(resolve(migrationsDirectory, migration.filename), "utf8");
    await input.database.query(sql);
    appliedMigrations.push(migration.filename);
  }

  return appliedMigrations;
}

async function seedContracts(input: {
  readonly runtime: Runtime;
  readonly repositoryRoot: string;
  readonly seedLimit: number;
}): Promise<readonly SeededContract[]> {
  const env = loadEnv();
  const fileHash = new FileHashService();
  const workingSubsetRoot = resolve(input.repositoryRoot, "working-subset");
  const manifestPath = join(workingSubsetRoot, "manifest.json");
  const manifest = parseCuadManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  const fixtures = await readFixtures(input.repositoryRoot);
  const seeded: SeededContract[] = [];

  for (const [index, entry] of manifest.contracts.slice(0, input.seedLimit).entries()) {
    const filePath = resolveWorkingSubsetPath({
      workingSubsetRoot,
      relativePath: entry.relativePath,
    });
    const body = await readFile(filePath);
    const sha256 = fileHash.sha256(body);
    if (sha256 !== entry.sha256) {
      throw new Error(`SHA-256 mismatch for ${entry.datasetId}`);
    }

    const result = await input.runtime.ingestion.ingest({
      file: {
        originalFilename: entry.filename,
        mimeType: "application/pdf",
        sizeBytes: body.byteLength,
        body,
      },
      displayName: entry.originalDocumentName,
      externalRef: entry.datasetId,
      organizationId: env.INGESTION_DEFAULT_ORGANIZATION_ID,
      uploadedBy: env.INGESTION_DEFAULT_USER_ID,
      sourceType: "CUAD_SEED",
      sourceReference: JSON.stringify({
        source: entry.source,
        datasetId: entry.datasetId,
        originalDocumentName: entry.originalDocumentName,
      }),
      correlationId: `dev-reset-seed:${entry.datasetId}`,
    });

    const fixture = fixtures[index];
    seeded.push({
      contractId: result.contractId,
      documentId: result.documentId,
      processingRunId: result.processingRunId,
      displayName: entry.originalDocumentName,
      sampleText:
        fixture?.sampleText ??
        `${entry.originalDocumentName} includes renewal, notice, reporting, and payment obligations.`,
    });
  }

  return seeded;
}

async function seedWorkflowData(input: {
  readonly runtime: Runtime;
  readonly contracts: readonly SeededContract[];
}): Promise<{
  readonly obligations: number;
  readonly reminders: number;
  readonly reviewCandidates: number;
}> {
  const env = loadEnv();
  const now = new Date();
  let obligationCount = 0;
  let reminderCount = 0;
  let reviewCandidateCount = 0;

  for (const [index, contract] of input.contracts.entries()) {
    const pageText = contract.sampleText;
    await input.runtime.transactions.inTransaction(async (transaction) => {
      await input.runtime.textPages.replacePages(
        {
          organizationId: env.INGESTION_DEFAULT_ORGANIZATION_ID,
          contractId: contract.contractId,
          documentId: contract.documentId,
          processingRunId: contract.processingRunId,
          pages: [
            {
              pageNumber: 1,
              extractionMethod: "PDF_TEXT",
              rawText: pageText,
              normalizedText: pageText,
              charCount: pageText.length,
              wordCount: countWords(pageText),
              printableRatio: 1,
              pageWidth: 612,
              pageHeight: 792,
              segments: [
                {
                  index: 0,
                  pageNumber: 1,
                  text: pageText,
                  startOffset: 0,
                  endOffset: pageText.length,
                },
              ],
              warnings: [],
            },
          ],
        },
        transaction,
      );
      await transaction.client.query(
        `
          UPDATE contract_processing_runs
          SET status = $2,
              completed_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `,
        [contract.processingRunId, index % 3 === 0 ? "REVIEW_REQUIRED" : "COMPLETED"],
      );
      await transaction.client.query(
        `
          UPDATE background_jobs
          SET status = 'COMPLETED',
              completed_at = NOW(),
              updated_at = NOW()
          WHERE idempotency_key = $1
        `,
        [`contract-processing:${contract.processingRunId}`],
      );
    });

    const createdObligations = await input.runtime.transactions.inTransaction((transaction) =>
      input.runtime.obligations.upsertExtractedForContract(
        {
          contractId: contract.contractId,
          obligations: [
            {
              title: "Renewal notice",
              description: "Send renewal notice before the current term expires.",
              dueAt: addDays(now, 30 + index),
              anchors: [
                {
                  pageNumber: 1,
                  lineOffset: 1,
                  quotedText: "auto-renews for 12 months unless either party gives notice",
                },
              ],
            },
            {
              title: "Payment review",
              description: "Review the contract value and confirm payment schedule compliance.",
              dueAt: addDays(now, index % 2 === 0 ? 5 : -3),
              anchors: [
                {
                  pageNumber: 1,
                  lineOffset: 2,
                  quotedText: "The total contract value is documented in the agreement.",
                },
              ],
            },
            {
              title: "Quarterly service report",
              description: "Collect the service performance report for the contract owner.",
              dueAt: addDays(now, 60 + index),
              anchors: [
                {
                  pageNumber: 1,
                  lineOffset: 3,
                  quotedText: "Reporting and operational obligations remain active.",
                },
              ],
            },
          ],
        },
        transaction,
      ),
    );
    obligationCount += createdObligations.length;

    await transitionSampleObligations(
      input.runtime,
      createdObligations,
      index,
      env.INGESTION_DEFAULT_USER_ID,
    );
    reminderCount += await seedReminders(input.runtime, createdObligations);

    if (index % 3 === 0) {
      await input.runtime.extractionCandidates.createPending({
        contractId: contract.contractId,
        documentId: contract.documentId,
        extractedJson: {
          obligations: [
            {
              title: "Ambiguous indemnity follow-up",
              description:
                "Confirm whether the indemnity clause creates a recurring reporting duty.",
              dueDate: addDays(now, 45).toISOString(),
              sourceAnchors: [
                {
                  pageNumber: 1,
                  startLine: 4,
                  endLine: 5,
                  quotedText: "Indemnity language requires reviewer confirmation.",
                },
              ],
            },
          ],
        },
        confidence: 0.57,
        validationIssues: ["LOW_CONFIDENCE", "AMBIGUOUS_DUE_DATE"],
      });
      reviewCandidateCount += 1;
    }
  }

  await input.runtime.audit.append({
    actor: { id: env.INGESTION_DEFAULT_USER_ID, type: "SYSTEM" },
    action: "DEV_DATA_RESET_AND_SEEDED",
    entityType: "SYSTEM",
    entityId: "dev-data",
    newData: {
      contracts: input.contracts.length,
      obligations: obligationCount,
      reminders: reminderCount,
      reviewCandidates: reviewCandidateCount,
    },
    correlationId: "dev-reset-seed",
    timestamp: now,
  });

  return {
    obligations: obligationCount,
    reminders: reminderCount,
    reviewCandidates: reviewCandidateCount,
  };
}

async function transitionSampleObligations(
  runtime: Runtime,
  obligations: readonly ObligationRecord[],
  contractIndex: number,
  actorId: string,
): Promise<void> {
  const paymentReview = obligations.find((obligation) => obligation.title === "Payment review");
  if (!paymentReview) {
    return;
  }

  await runtime.obligationService.transition({
    obligationId: paymentReview.id,
    fromStatus: "UPCOMING",
    toStatus: "DUE",
    expectedVersion: 0,
    actorId,
  });

  const terminalStatus: ObligationStatus | null =
    contractIndex % 4 === 1 ? "MET" : contractIndex % 4 === 3 ? "MISSED" : null;
  if (!terminalStatus) {
    return;
  }

  await runtime.obligationService.transition({
    obligationId: paymentReview.id,
    fromStatus: "DUE",
    toStatus: terminalStatus,
    expectedVersion: 1,
    actorId,
  });
}

async function seedReminders(
  runtime: Runtime,
  obligations: readonly ObligationRecord[],
): Promise<number> {
  let inserted = 0;
  for (const obligation of obligations) {
    if (!obligation.dueAt) {
      continue;
    }
    const scheduledFor = addDays(obligation.dueAt, -3);
    const occurrenceKey = createReminderOccurrenceKey({
      obligationId: obligation.id,
      scheduledFor,
    });
    const result = await runtime.database.query<{ readonly id: string }>(
      `
        INSERT INTO reminders (obligation_id, scheduled_for, occurrence_key, status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (occurrence_key) DO NOTHING
        RETURNING id
      `,
      [
        obligation.id,
        scheduledFor,
        occurrenceKey,
        obligation.status === "MET" ? "DELIVERED" : "PENDING",
      ],
    );
    const reminder = result.rows[0];
    if (reminder) {
      inserted += 1;
      if (obligation.status !== "MET") {
        await runtime.database.query(
          `
            INSERT INTO inbox_entries (reminder_id, obligation_id, payload)
            VALUES ($1, $2, $3::jsonb)
            ON CONFLICT (reminder_id) DO NOTHING
          `,
          [
            reminder.id,
            obligation.id,
            JSON.stringify({
              type: "OBLIGATION_REMINDER",
              obligationTitle: obligation.title,
              scheduledFor: scheduledFor.toISOString(),
            }),
          ],
        );
      }
    }
  }
  return inserted;
}

async function main(): Promise<void> {
  requireResetConfirmation();
  const repositoryRoot = resolve(process.cwd(), "../..");
  const seedLimit = parseSeedLimit();
  const runtime = createRuntime();

  try {
    const appliedMigrations = await applyRequiredMigrations({
      database: runtime.database,
      repositoryRoot,
    });
    const removedStorageObjects = await truncateStorageBucket();
    const truncatedTables = await truncateDatabase(runtime.database);
    const contracts = await seedContracts({ runtime, repositoryRoot, seedLimit });
    const workflow = await seedWorkflowData({ runtime, contracts });

    console.log("dev_data_reset_complete");
    console.log(`Required migrations applied: ${appliedMigrations.length}`);
    console.log(`Storage objects removed: ${removedStorageObjects}`);
    console.log(`Tables truncated: ${truncatedTables.length}`);
    console.log(`Contracts seeded: ${contracts.length}`);
    console.log(`Obligations seeded: ${workflow.obligations}`);
    console.log(`Reminders seeded: ${workflow.reminders}`);
    console.log(`Review candidates seeded: ${workflow.reviewCandidates}`);
  } finally {
    await runtime.database.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
