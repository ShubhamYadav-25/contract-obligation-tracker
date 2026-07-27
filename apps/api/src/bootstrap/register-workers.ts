/**
 * @file Defines API bootstrap wiring for routes, workers, schedulers, or shutdown handling.
 */
import type { Logger } from "../config/logger.js";
import { createDatabaseConfig } from "../config/database.js";
import { createEmailConfig, type EmailConfig } from "../config/email.js";
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
import { GeminiStructuredLlmClient } from "../infrastructure/llm/gemini-structured-llm.client.js";
import { GroqLlmAdapter } from "../infrastructure/llm/groq.adapter.js";
import { BrevoEmailAdapter } from "../infrastructure/email/brevo.adapter.js";
import { MailtrapEmailAdapter } from "../infrastructure/email/mailtrap.adapter.js";
import { ResendEmailAdapter } from "../infrastructure/email/resend.adapter.js";
import { SupabaseStorageProvider } from "../infrastructure/storage/supabase-storage.provider.js";
import { ContractProcessingOrchestrator } from "../modules/contracts/contract-processing-orchestrator.service.js";
import { DocumentTextProcessingPipeline } from "../modules/contracts/document-text-processing.pipeline.js";
import {
  GroqObligationExtractionProvider,
  HeuristicObligationExtractionProvider,
  TriggeredFallbackObligationExtractionProvider,
  type ObligationExtractionProvider,
} from "../modules/extraction/obligation-extraction.provider.js";
import { ReferenceAwareObligationExtractor } from "../modules/extraction/reference-aware/index.js";
import { PostgresAuditRepository } from "../modules/audit/postgres-audit.repository.js";
import {
  PostgresContractDocumentRepository,
  PostgresContractProcessingRepository,
  PostgresDocumentTextPageRepository,
} from "../modules/contracts/postgres-contract.repository.js";
import { PostgresObligationRepository } from "../modules/obligations/postgres-obligation.repository.js";
import { PostgresReminderRepository } from "../modules/reminders/postgres-reminder.repository.js";
import { JobRepository, PostgresJobRepository } from "../jobs/job.repository.js";
import { JobRunner } from "../jobs/job-runner.js";
import { JobPoller } from "../jobs/pollers/job-poller.js";
import { PollingLoop } from "../jobs/pollers/polling-loop.js";
import { ContractProcessingProcessor } from "../jobs/processors/contract-processing.processor.js";
import { ProcessorRegistry } from "../jobs/processors/processor-registry.js";
import { ReminderDeliveryProcessor } from "../jobs/processors/reminder-delivery.processor.js";
import {
  ConsoleNotificationProvider,
  type NotificationProvider,
} from "../modules/notifications/index.js";
import { ApplicationError } from "../shared/errors/application-error.js";

export interface WorkerRegistry extends CloseableResource {
  readonly names: readonly string[];
}

export interface WorkerRuntime extends CloseableResource {
  readonly names: readonly string[];
  start(): void;
  runOnce(): Promise<number>;
}

interface NotificationRuntime {
  readonly provider: NotificationProvider;
  readonly providerName: string;
  readonly from?: string;
  readonly defaultRecipient?: string;
}

/**
 * @description Executes the create obligation extractor operation used by the application workflow.
 * @param {{ readonly env: ReturnType<typeof loadEnv>; readonly logger: Logger; }} { env, logger, } - Input value for { env, logger, }.
 * @returns {ObligationExtractionProvider} Result of the create obligation extractor operation.
 */
export function createObligationExtractor({
  env,
  logger,
}: {
  readonly env: ReturnType<typeof loadEnv>;
  readonly logger: Logger;
}): ObligationExtractionProvider {
  const heuristicObligationExtractor = new HeuristicObligationExtractionProvider();

  if (env.OBLIGATION_EXTRACTOR_MODE === "auto") {
    return env.GROQ_API_KEY
      ? createGroqObligationExtractor({ env, logger, fallback: heuristicObligationExtractor })
      : heuristicObligationExtractor;
  }

  if (env.OBLIGATION_EXTRACTOR_MODE === "heuristic") {
    return heuristicObligationExtractor;
  }

  if (env.OBLIGATION_EXTRACTOR_MODE === "groq") {
    return createGroqObligationExtractor({ env, logger, fallback: heuristicObligationExtractor });
  }

  if (env.OBLIGATION_EXTRACTOR_MODE === "reference-aware-gemini") {
    const geminiExtractor = new ReferenceAwareObligationExtractor({
      llm: new GeminiStructuredLlmClient({ env, logger }),
      logger,
      config: {
        maxWindowsPerBatch: env.GEMINI_MAX_WINDOWS_PER_BATCH,
        maxBatchInputCharacters: env.GEMINI_MAX_BATCH_INPUT_CHARACTERS,
        maxBatchOutputTokens: env.GEMINI_MAX_BATCH_OUTPUT_TOKENS,
      },
    });
    if (!env.GROQ_API_KEY) {
      return geminiExtractor;
    }

    return new TriggeredFallbackObligationExtractionProvider({
      primary: geminiExtractor,
      fallback: createGroqObligationExtractor({
        env,
        logger,
        fallback: heuristicObligationExtractor,
      }),
      shouldFallback: isGeminiQuotaFallbackTrigger,
      logger,
    });
  }

  return heuristicObligationExtractor;
}

export function isGeminiQuotaFallbackTrigger(error: unknown): boolean {
  if (!(error instanceof ApplicationError)) {
    return false;
  }

  if (
    error.message === "DAILY_QUOTA_EXHAUSTED" ||
    error.message === "GEMINI_CONTRACT_REQUEST_BUDGET_EXCEEDED"
  ) {
    return true;
  }

  const quota =
    error.details.quota && typeof error.details.quota === "object"
      ? (error.details.quota as Record<string, unknown>)
      : undefined;
  return error.details.status === 429 || quota !== undefined;
}

/**
 * @description Executes the create groq obligation extractor operation used by the application workflow.
 * @param {{ readonly env: ReturnType<typeof loadEnv>; readonly logger: Logger; readonly fallback: ObligationExtractionProvider; }} { env, logger, fallback, } - Input value for { env, logger, fallback, }.
 * @returns {ObligationExtractionProvider} Result of the create groq obligation extractor operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
function createGroqObligationExtractor({
  env,
  logger,
  fallback,
}: {
  readonly env: ReturnType<typeof loadEnv>;
  readonly logger: Logger;
  readonly fallback: ObligationExtractionProvider;
}): ObligationExtractionProvider {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required when OBLIGATION_EXTRACTOR_MODE=groq");
  }

  return new GroqObligationExtractionProvider({
    llm: new GroqLlmAdapter({
      apiKey: env.GROQ_API_KEY,
      defaultModel: env.GROQ_EXTRACTION_MODEL,
      temperature: env.GROQ_EXTRACTION_TEMPERATURE,
      maxTokens: env.GROQ_EXTRACTION_MAX_TOKENS,
    }),
    fallback,
    logger,
    config: {
      model: env.GROQ_EXTRACTION_MODEL,
      timeoutMilliseconds: env.GROQ_EXTRACTION_TIMEOUT_MS,
      maxAttempts: env.GROQ_EXTRACTION_MAX_ATTEMPTS,
      retryBaseDelayMilliseconds: env.GROQ_EXTRACTION_RETRY_BASE_DELAY_MS,
      retryMaxDelayMilliseconds: env.GROQ_EXTRACTION_RETRY_MAX_DELAY_MS,
    },
  });
}

/**
 * @description Creates the notification provider used by reminder delivery jobs.
 * @param {{ readonly emailConfig: EmailConfig; readonly logger: Logger; }} input - Email settings and logger dependencies.
 * @returns {NotificationRuntime} Provider instance and metadata for reminder attempts.
 * @throws {Error} When the selected email provider lacks required configuration.
 */
function createNotificationRuntime(input: {
  readonly emailConfig: EmailConfig;
  readonly logger: Logger;
}): NotificationRuntime {
  const { emailConfig, logger } = input;
  if (emailConfig.provider === "brevo" || emailConfig.provider === "smtp") {
    if (!emailConfig.brevo.apiKey || !emailConfig.from) {
      throw new Error("Brevo email configuration is incomplete");
    }

    return {
      provider: new BrevoEmailAdapter({
        apiKey: emailConfig.brevo.apiKey,
        senderEmail: emailConfig.from,
        senderName: emailConfig.fromName ?? "Contract Obligation Tracker",
      }),
      providerName: "BREVO",
      from: emailConfig.from,
      ...(emailConfig.defaultRecipient ? { defaultRecipient: emailConfig.defaultRecipient } : {}),
    };
  }

  if (emailConfig.provider === "mailtrap") {
    return {
      provider: new MailtrapEmailAdapter(),
      providerName: "MAILTRAP",
      ...(emailConfig.from ? { from: emailConfig.from } : {}),
      ...(emailConfig.defaultRecipient ? { defaultRecipient: emailConfig.defaultRecipient } : {}),
    };
  }

  if (emailConfig.provider === "resend") {
    return {
      provider: new ResendEmailAdapter(),
      providerName: "RESEND",
      ...(emailConfig.from ? { from: emailConfig.from } : {}),
      ...(emailConfig.defaultRecipient ? { defaultRecipient: emailConfig.defaultRecipient } : {}),
    };
  }

  return {
    provider: new ConsoleNotificationProvider(logger),
    providerName: "CONSOLE",
    ...(emailConfig.from ? { from: emailConfig.from } : {}),
    defaultRecipient: emailConfig.defaultRecipient ?? "development-reviewer@example.com",
  };
}

/**
 * @description Executes the create worker runtime operation used by the application workflow.
 * @param {{ readonly logger: Logger }} { logger } - Input value for { logger }.
 * @returns {WorkerRuntime} Result of the create worker runtime operation.
 */
export function createWorkerRuntime({ logger }: { readonly logger: Logger }): WorkerRuntime {
  const env = loadEnv();
  const jobConfig = createJobConfig(env);
  const storageConfig = createStorageConfig(env);
  const emailConfig = createEmailConfig(env);
  const notificationRuntime = createNotificationRuntime({ emailConfig, logger });
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const audit = new PostgresAuditRepository(database);
  const processingRuns = new PostgresContractProcessingRepository(database);
  const obligations = new PostgresObligationRepository(transactions);
  const reminders = new PostgresReminderRepository(transactions);
  const jobs: JobRepository = new PostgresJobRepository(database, transactions);
  const obligationExtractor = createObligationExtractor({ env, logger });
  const orchestrator = new ContractProcessingOrchestrator({
    processingRuns,
    audit,
    transactions,
    pipeline: new DocumentTextProcessingPipeline({
      documents: new PostgresContractDocumentRepository(database),
      processingRuns,
      textPages: new PostgresDocumentTextPageRepository(database),
      obligations,
      reminders,
      audit,
      storage: new SupabaseStorageProvider(storageConfig),
      parser: new NativePdfTextExtractorAdapter(),
      pageRenderer: new PdfJsPageRendererAdapter(),
      tesseractOcr: new TesseractOcrAdapter(),
      geminiVisionOcr: new GeminiVisionOcrAdapter(),
      obligationExtractor,
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
  const reminderProcessor = new ReminderDeliveryProcessor(
    database,
    transactions,
    notificationRuntime.provider,
    {
      providerName: notificationRuntime.providerName,
      appName: env.APP_NAME,
      appBaseUrl: env.APP_BASE_URL,
      ...(notificationRuntime.from ? { from: notificationRuntime.from } : {}),
      ...(notificationRuntime.defaultRecipient
        ? { defaultRecipient: notificationRuntime.defaultRecipient }
        : {}),
    },
  );
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
  const recoveryLoop = new PollingLoop(
    {
      poll: async () => {
        const recovered = await jobs.recoverExpiredJobs(new Date());
        if (recovered.length > 0) {
          logger.warn("expired_job_locks_recovered", { count: recovered.length });
        }
        return recovered.length;
      },
    },
    jobConfig.pollIntervalMilliseconds,
    logger,
  );
  const names = ["PROCESS_CONTRACT", "DELIVER_REMINDER"] as const;

  return {
    names,

    /**
     * @description Implements the start method for this service or adapter.
     * @returns {unknown} Result of the start operation.
    */ start() {
      pollingLoop.start();
      recoveryLoop.start();
      logger.info("workers_registered", { workers: names });
    },

    /**
     * @description Implements the run once method for this service or adapter.
     * @returns {unknown} Result of the run once operation.
     */ runOnce() {
      return runner.runOnce();
    },

    /**
     * @description Implements the close method for this service or adapter.
     * @returns {Promise<unknown>} Result of the close operation.
    */ async close() {
      pollingLoop.close();
      recoveryLoop.close();
      await database.close();
      logger.info("workers_closed");
    },
  };
}

/**
 * @description Performs the register workers helper operation for this module.
 * @param {{ readonly logger: Logger; readonly createRuntime?: (input: { readonly logger: Logger }) => WorkerRuntime; }} { createRuntime = createWorkerRuntime, logger, } - Input value for { create runtime = create worker runtime, logger, }.
 * @returns {WorkerRegistry} Result of the register workers operation.
 */
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
