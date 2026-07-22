import type { Logger } from "../config/logger.js";
import { createDatabaseConfig } from "../config/database.js";
import { loadEnv } from "../config/env.js";
import { createJobConfig } from "../config/jobs.js";
import { createStorageConfig } from "../config/storage.js";
import type { CloseableResource } from "./graceful-shutdown.js";
import { SystemClock } from "../infrastructure/clock/clock.js";
import { PgPoolClient } from "../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../infrastructure/database/transaction-manager.js";
import { NativePdfTextExtractorAdapter } from "../infrastructure/pdf/native-pdf-text-extractor.adapter.js";
import { PdfJsPageRendererAdapter } from "../infrastructure/pdf/pdfjs-page-renderer.adapter.js";
import { GeminiVisionOcrAdapter } from "../infrastructure/ocr/gemini-vision.adapter.js";
import { TesseractOcrAdapter } from "../infrastructure/ocr/tesseract.adapter.js";
import { SupabaseStorageProvider } from "../infrastructure/storage/supabase-storage.provider.js";
import { ContractProcessingOrchestrator } from "../modules/contracts/contract-processing-orchestrator.service.js";
import { DocumentTextProcessingPipeline } from "../modules/contracts/document-text-processing.pipeline.js";
import { PostgresAuditRepository } from "../modules/audit/postgres-audit.repository.js";
import {
  PostgresContractDocumentRepository,
  PostgresContractProcessingRepository,
  PostgresDocumentTextPageRepository,
} from "../modules/contracts/postgres-contract.repository.js";
import { JobRepository, PostgresJobRepository } from "../jobs/job.repository.js";
import { JobRunner } from "../jobs/job-runner.js";
import { JobPoller } from "../jobs/pollers/job-poller.js";
import { PollingLoop } from "../jobs/pollers/polling-loop.js";
import { ContractProcessingProcessor } from "../jobs/processors/contract-processing.processor.js";
import { ProcessorRegistry } from "../jobs/processors/processor-registry.js";
import { ReminderDeliveryProcessor } from "../jobs/processors/reminder-delivery.processor.js";

export interface WorkerRegistry extends CloseableResource {
  readonly names: readonly string[];
}

export interface WorkerRuntime extends CloseableResource {
  readonly names: readonly string[];
  start(): void;
}

export function createWorkerRuntime({ logger }: { readonly logger: Logger }): WorkerRuntime {
  const env = loadEnv();
  const jobConfig = createJobConfig(env);
  const storageConfig = createStorageConfig(env);
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const audit = new PostgresAuditRepository(database);
  const processingRuns = new PostgresContractProcessingRepository(database);
  const jobs: JobRepository = new PostgresJobRepository(database, transactions);
  const orchestrator = new ContractProcessingOrchestrator({
    processingRuns,
    audit,
    transactions,
    pipeline: new DocumentTextProcessingPipeline({
      documents: new PostgresContractDocumentRepository(database),
      processingRuns,
      textPages: new PostgresDocumentTextPageRepository(database),
      audit,
      storage: new SupabaseStorageProvider(storageConfig),
      parser: new NativePdfTextExtractorAdapter(),
      pageRenderer: new PdfJsPageRendererAdapter(),
      tesseractOcr: new TesseractOcrAdapter(),
      geminiVisionOcr: new GeminiVisionOcrAdapter(),
      transactions,
      logger,
      config: {
        quality: {
          minCharacters: env.DOCUMENT_TEXT_MIN_CHARACTERS,
          minWords: env.DOCUMENT_TEXT_MIN_WORDS,
          minPrintableRatio: env.DOCUMENT_TEXT_MIN_PRINTABLE_RATIO,
          maxIsolatedTokenRatio: env.DOCUMENT_TEXT_MAX_ISOLATED_TOKEN_RATIO,
        },
        segmentation: {
          maxSegmentCharacters: env.DOCUMENT_SEGMENT_MAX_CHARACTERS,
          lineOverlap: env.DOCUMENT_SEGMENT_LINE_OVERLAP,
        },
        ocrTimeoutMilliseconds: env.OCR_TIMEOUT_MS,
        ocrMinConfidence: env.OCR_MIN_CONFIDENCE,
        ocrRenderScale: env.OCR_RENDER_SCALE,
        geminiFallbackEnabled: env.GEMINI_OCR_FALLBACK_ENABLED,
      },
    }),
    logger,
  });
  const contractProcessor = new ContractProcessingProcessor(orchestrator);
  const reminderProcessor = new ReminderDeliveryProcessor(database, transactions);
  const registry = new ProcessorRegistry(
    new Map([
      ["PROCESS_CONTRACT", (job) => contractProcessor.process(job)],
      ["DELIVER_REMINDER", (job) => reminderProcessor.process(job)],
    ]),
  );
  const runner = new JobRunner(jobs, registry, jobConfig, new SystemClock(), logger);
  const pollingLoop = new PollingLoop(
    new JobPoller(runner),
    jobConfig.pollIntervalMilliseconds,
    logger,
  );
  const names = ["PROCESS_CONTRACT"] as const;

  return {
    names,
    start() {
      pollingLoop.start();
      logger.info("workers_registered", { workers: names });
    },
    async close() {
      pollingLoop.close();
      await database.close();
      logger.info("workers_closed");
    },
  };
}

export function registerWorkers({
  createRuntime = createWorkerRuntime,
  logger,
}: {
  readonly logger: Logger;
  readonly createRuntime?: (input: { readonly logger: Logger }) => WorkerRuntime;
}): WorkerRegistry {
  const runtime = createRuntime({ logger });
  runtime.start();
  return runtime;
}
