import { z } from "zod";

import { loadDotEnvFile } from "./dotenv.js";

const integerFromEnv = z.coerce.number().int().positive();
const booleanFromEnv = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

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
    GROQ_API_KEY: z.string().optional(),
    GROQ_EXTRACTION_MODEL: z.string().min(1).default("llama-3.1-8b-instant"),
    GROQ_EXTRACTION_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),
    GROQ_EXTRACTION_MAX_TOKENS: integerFromEnv.default(2_048),
    GROQ_EXTRACTION_TIMEOUT_MS: integerFromEnv.default(45_000),
    GROQ_EXTRACTION_MAX_ATTEMPTS: integerFromEnv.default(3),
    GROQ_EXTRACTION_RETRY_BASE_DELAY_MS: integerFromEnv.default(1_000),
    GROQ_EXTRACTION_RETRY_MAX_DELAY_MS: integerFromEnv.default(10_000),
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
    EMAIL_PROVIDER: z.enum(["console", "mailtrap", "resend", "smtp"]).default("console"),
    EMAIL_FROM: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: integerFromEnv.default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    JWT_SECRET: z.string().optional(),
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
  });

export type ApiEnv = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): ApiEnv {
  return envSchema.parse(source);
}

export function loadEnv(): ApiEnv {
  loadDotEnvFile();
  return parseEnv(process.env);
}

export function getCorsOrigin(): string {
  return process.env.CORS_ORIGIN ?? "http://localhost:5173";
}
