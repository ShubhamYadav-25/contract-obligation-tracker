/**
 * @file Defines backend runtime configuration and environment helpers.
 */
import { z } from "zod";

import { loadDotEnvFile } from "./dotenv.js";

const integerFromEnv = z.coerce.number().int().positive();
const booleanFromEnv = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");
const placeholderValues = new Set(["your_api_key", "replace-me", "undefined", "change_me"]);

/**
 * @description Performs the trimmed optional string helper operation for this module.
 * @param {unknown} value - Input value for value.
 * @returns {string | undefined} Result of the trimmed optional string operation.
 */
function trimmedOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * @description Performs the is placeholder value helper operation for this module.
 * @param {string | undefined} value - Input value for value.
 * @returns {boolean} Result of the is placeholder value operation.
 */
function isPlaceholderValue(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return placeholderValues.has(normalized) || /^<[^>]+>$/.test(normalized);
}

const optionalTrimmedString = z.preprocess(trimmedOptionalString, z.string().optional());
const optionalTrimmedNonEmptyString = z.preprocess(
  trimmedOptionalString,
  z.string().min(1).optional(),
);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_NAME: z.string().min(1).default("Contract Obligation Tracker"),
    APP_BASE_URL: z.url().default("http://localhost:5173"),
    API_HOST: z.string().min(1).default("0.0.0.0"),
    API_PORT: integerFromEnv.default(3000),
    CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
    CONTRACT_MAX_FILE_SIZE_MB: integerFromEnv.default(20),
    CONTRACT_MAX_PAGE_COUNT: integerFromEnv.default(300),
    CUAD_IMPORT_CONCURRENCY: integerFromEnv.default(2),
    INGESTION_DEFAULT_ORGANIZATION_ID: z.uuid().default("00000000-0000-4000-8000-000000000001"),
    INGESTION_DEFAULT_USER_ID: z.uuid().default("00000000-0000-4000-8000-000000000002"),
    DATABASE_URL: z.string().optional(),
    DATABASE_SSL: booleanFromEnv.default(true),
    DATABASE_POOL_MAX: integerFromEnv.default(5),
    DATABASE_CONNECTION_TIMEOUT_MS: integerFromEnv.default(5_000),
    DATABASE_IDLE_TIMEOUT_MS: integerFromEnv.default(30_000),
    STORAGE_PROVIDER: z.enum(["supabase", "local"]).default("supabase"),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().min(1).default("contracts"),
    OBLIGATION_EXTRACTOR_MODE: z
      .enum(["auto", "heuristic", "groq", "reference-aware-gemini"])
      .default("auto"),
    GROQ_API_KEY: optionalTrimmedString,
    GROQ_EXTRACTION_MODEL: z.string().min(1).default("llama-3.1-8b-instant"),
    GROQ_EXTRACTION_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),
    GROQ_EXTRACTION_MAX_TOKENS: integerFromEnv.default(2_048),
    GROQ_EXTRACTION_TIMEOUT_MS: integerFromEnv.default(45_000),
    GROQ_EXTRACTION_MAX_ATTEMPTS: integerFromEnv.default(3),
    GROQ_EXTRACTION_RETRY_BASE_DELAY_MS: integerFromEnv.default(1_000),
    GROQ_EXTRACTION_RETRY_MAX_DELAY_MS: integerFromEnv.default(10_000),
    GEMINI_API_KEY: optionalTrimmedString,
    GEMINI_MODEL: optionalTrimmedNonEmptyString,
    GOOGLE_API_KEY: optionalTrimmedString,
    GEMINI_REQUEST_TIMEOUT_MS: integerFromEnv.default(45_000),
    GEMINI_MAX_ATTEMPTS: integerFromEnv.default(3),
    GEMINI_MAX_REQUESTS_PER_CONTRACT: integerFromEnv.default(8),
    GEMINI_MIN_REQUEST_INTERVAL_MS: z.coerce.number().int().min(0).default(15_000),
    GEMINI_MAX_QUOTA_RETRIES: z.coerce.number().int().min(0).default(4),
    GEMINI_MAX_RETRY_DELAY_MS: integerFromEnv.default(120_000),
    GEMINI_MAX_WINDOWS_PER_BATCH: integerFromEnv.default(4),
    GEMINI_MAX_BATCH_INPUT_CHARACTERS: integerFromEnv.default(18_000),
    GEMINI_MAX_BATCH_OUTPUT_TOKENS: integerFromEnv.default(6_000),
    OCR_PROVIDER: z.enum(["tesseract", "gemini-vision"]).default("tesseract"),
    TESSERACT_WORKER_COUNT: integerFromEnv.default(1),
    DOCUMENT_TEXT_MIN_CHARACTERS: integerFromEnv.default(25),
    DOCUMENT_TEXT_MIN_WORDS: integerFromEnv.default(5),
    DOCUMENT_TEXT_MIN_PRINTABLE_RATIO: z.coerce.number().min(0).max(1).default(0.75),
    DOCUMENT_TEXT_MAX_ISOLATED_TOKEN_RATIO: z.coerce.number().min(0).max(1).default(0.45),
    DOCUMENT_SEGMENT_MAX_CHARACTERS: integerFromEnv.default(1_200),
    DOCUMENT_SEGMENT_LINE_OVERLAP: z.coerce.number().int().min(0).default(0),
    OCR_TIMEOUT_MS: integerFromEnv.default(30_000),
    OCR_MIN_CONFIDENCE: z.coerce.number().min(0).max(100).default(40),
    OCR_RENDER_SCALE: z.coerce.number().positive().default(2),
    GEMINI_OCR_FALLBACK_ENABLED: booleanFromEnv.default(false),
    EMAIL_PROVIDER: z.enum(["console", "brevo", "mailtrap", "resend", "smtp"]).default("console"),
    EMAIL_FROM_ADDRESS: optionalTrimmedString,
    EMAIL_FROM_NAME: optionalTrimmedString,
    REMINDER_RECIPIENT_EMAIL: optionalTrimmedString,
    BREVO_API_KEY: optionalTrimmedString,
    SMTP_HOST: optionalTrimmedString,
    SMTP_PORT: integerFromEnv.default(587),
    SMTP_USER: optionalTrimmedString,
    SMTP_PASSWORD: optionalTrimmedString,
    JWT_SECRET: optionalTrimmedString,
    JWT_ISSUER: z.string().min(1).default("contract-obligation-tracker"),
    JWT_AUDIENCE: z.string().min(1).default("contract-obligation-tracker"),
    JWT_ACCESS_TOKEN_TTL_SECONDS: integerFromEnv.default(900),
    JOB_POLL_INTERVAL_MS: integerFromEnv.default(2_000),
    JOB_BATCH_SIZE: integerFromEnv.default(5),
    JOB_LOCK_DURATION_MS: integerFromEnv.default(300_000),
    JOB_MAX_ATTEMPTS: integerFromEnv.default(5),
    JOB_RETRY_BASE_DELAY_MS: integerFromEnv.default(30_000),
    JOB_RETRY_MAX_DELAY_MS: integerFromEnv.default(1_800_000),
    WORKER_ID: z.string().min(1).default("local-worker"),
    REMINDER_CRON_TIMEZONE: z.string().min(1).default("UTC"),
    SCHEDULER_CRON: z.string().min(1).default("*/5 * * * *"),
    REMINDER_LOOKAHEAD_MINUTES: integerFromEnv.default(15),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && !value.JWT_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "JWT_SECRET is required in production",
      });
    }
    if (value.NODE_ENV === "production" && !value.DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required in production",
      });
    }
    if (value.OBLIGATION_EXTRACTOR_MODE === "groq" && !value.GROQ_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["GROQ_API_KEY"],
        message: "GROQ_API_KEY is required when OBLIGATION_EXTRACTOR_MODE=groq",
      });
    }
    if (value.OBLIGATION_EXTRACTOR_MODE === "reference-aware-gemini") {
      if (isPlaceholderValue(value.GEMINI_API_KEY)) {
        context.addIssue({
          code: "custom",
          path: ["GEMINI_API_KEY"],
          message: "GEMINI_API_KEY must be a real local secret, not a placeholder",
        });
      }
      if (isPlaceholderValue(value.GEMINI_MODEL)) {
        context.addIssue({
          code: "custom",
          path: ["GEMINI_MODEL"],
          message: "GEMINI_MODEL must be a real model name, not a placeholder",
        });
      }
      if (!value.GEMINI_API_KEY) {
        context.addIssue({
          code: "custom",
          path: ["GEMINI_API_KEY"],
          message:
            "GEMINI_API_KEY is required when OBLIGATION_EXTRACTOR_MODE=reference-aware-gemini",
        });
      }
    }
    if (value.STORAGE_PROVIDER === "supabase" && value.NODE_ENV === "production") {
      if (!value.SUPABASE_URL) {
        context.addIssue({
          code: "custom",
          path: ["SUPABASE_URL"],
          message: "SUPABASE_URL is required when Supabase storage is enabled in production",
        });
      }
      if (!value.SUPABASE_SERVICE_ROLE_KEY) {
        context.addIssue({
          code: "custom",
          path: ["SUPABASE_SERVICE_ROLE_KEY"],
          message:
            "SUPABASE_SERVICE_ROLE_KEY is required when Supabase storage is enabled in production",
        });
      }
    }
    if (value.EMAIL_PROVIDER === "brevo" || value.EMAIL_PROVIDER === "smtp") {
      if (!value.EMAIL_FROM_ADDRESS) {
        context.addIssue({
          code: "custom",
          path: ["EMAIL_FROM_ADDRESS"],
          message: "EMAIL_FROM_ADDRESS is required when Brevo email delivery is enabled",
        });
      }
      if (!value.BREVO_API_KEY) {
        context.addIssue({
          code: "custom",
          path: ["BREVO_API_KEY"],
          message: "BREVO_API_KEY is required when Brevo email delivery is enabled",
        });
      }
    }
  });

export type ApiEnv = z.infer<typeof envSchema>;

/**
 * @description Performs the parse env helper operation for this module.
 * @param {NodeJS.ProcessEnv} source - Input value for source.
 * @returns {ApiEnv} Result of the parse env operation.
 */
export function parseEnv(source: NodeJS.ProcessEnv): ApiEnv {
  return envSchema.parse({
    ...source,
    API_PORT: source.API_PORT ?? source.PORT,
  });
}

/**
 * @description Performs the load env helper operation for this module.
 * @returns {ApiEnv} Result of the load env operation.
 */
export function loadEnv(): ApiEnv {
  loadDotEnvFile();
  return parseEnv(process.env);
}

/**
 * @description Executes the get cors origin operation used by the application workflow.
 * @returns {string} Result of the get cors origin operation.
 */
export function getCorsOrigin(): string {
  return process.env.CORS_ORIGIN ?? "http://localhost:5173";
}
