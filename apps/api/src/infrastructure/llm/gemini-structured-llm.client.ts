/**
 * @file Defines LLM infrastructure clients and structured response helpers.
 */
import { z } from "zod";

import type { ApiEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type {
  StructuredLlmMetricsProvider,
  StructuredLlmMetricsSnapshot,
  StructuredLlmPreflightClient,
  StructuredLlmRequestBudgetProvider,
  StructuredLlmRequest,
} from "./structured-llm-client.js";
import { parseStructuredJson, validateStructuredData } from "./structured-llm-client.js";

export const DEFAULT_FREE_MODEL_CANDIDATES = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
] as const;

type GeminiStructuredLlmEnv = Pick<
  ApiEnv,
  | "GEMINI_API_KEY"
  | "GEMINI_MODEL"
  | "GEMINI_REQUEST_TIMEOUT_MS"
  | "GEMINI_MAX_ATTEMPTS"
  | "GEMINI_MAX_REQUESTS_PER_CONTRACT"
  | "GEMINI_MIN_REQUEST_INTERVAL_MS"
  | "GEMINI_MAX_QUOTA_RETRIES"
  | "GEMINI_MAX_RETRY_DELAY_MS"
  | "GEMINI_MAX_BATCH_OUTPUT_TOKENS"
  | "GOOGLE_API_KEY"
>;

export type GeminiErrorCategory =
  | "AUTHENTICATION_ERROR"
  | "MODEL_NOT_AVAILABLE"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "SCHEMA_NOT_SUPPORTED"
  | "INVALID_RESPONSE"
  | "UNKNOWN_ERROR";

export type GeminiQuotaCategory =
  | "REQUESTS_PER_MINUTE"
  | "TOKENS_PER_MINUTE"
  | "REQUESTS_PER_DAY"
  | "CONCURRENT_REQUESTS"
  | "TEMPORARY_CAPACITY"
  | "UNKNOWN_QUOTA";

export type GeminiQuotaError = {
  readonly category: GeminiQuotaCategory;
  readonly retryable: boolean;
  readonly retryAfterMilliseconds: number | null;
  readonly quotaMetric: string | null;
  readonly quotaId: string | null;
  readonly quotaDimensions: Record<string, string> | null;
  readonly model: string;
  readonly operation: string;
};

export interface GeminiModelSummary {
  readonly name: string;
  readonly supportsGenerateContent: boolean | null;
  readonly supportedActions: readonly string[];
}

export interface ModelSelectionAttempt {
  readonly model: string;
  readonly outcome: "SELECTED" | "NOT_LISTED" | "MODEL_NOT_FOUND" | "STRUCTURED_OUTPUT_FAILED";
  readonly errorCategory?: GeminiErrorCategory;
}

export interface ModelSelectionResult {
  readonly selectedModel: string;
  readonly selectionSource: "CONFIGURED_MODEL" | "LISTED_CANDIDATE" | "DIRECT_PREFLIGHT";
  readonly listedModels: readonly string[];
  readonly generateContentCapableModels: readonly string[];
  readonly listingSucceeded: boolean;
  readonly listingHadSupportedActions: boolean;
  readonly attemptedModels: readonly ModelSelectionAttempt[];
}

type GeminiSdkClient = {
  readonly models: {
    readonly generateContent: (request: unknown) => Promise<unknown>;
    readonly get?: (request: unknown) => Promise<unknown>;
    readonly list?: (request?: unknown) => Promise<unknown>;
  };
};

type GeminiSdkModule = {
  readonly GoogleGenAI: new (config: { readonly apiKey: string }) => GeminiSdkClient;
};

type GeminiSdkLoader = () => Promise<GeminiSdkModule>;
type Delay = (milliseconds: number) => Promise<void>;

interface GeminiStructuredLlmClientDependencies {
  readonly env: GeminiStructuredLlmEnv;
  readonly logger: Logger;
  readonly sdkLoader?: GeminiSdkLoader;
  readonly delay?: Delay;
  readonly modelCandidates?: readonly string[];
}

interface ClassifiedGeminiError {
  readonly retryable: boolean;
  readonly status?: number;
  readonly providerMessage?: string;
  readonly validationIssues?: unknown;
  readonly quotaError?: GeminiQuotaError;
}

const retryableStatusCodes = new Set([408, 429, 500, 502, 503, 504]);
const permanentStatusCodes = new Set([400, 401, 403, 404]);
const googleGenAiPackageName = "@google/genai";
const preflightJsonSchema = {
  type: "object",
  properties: { status: { type: "string", enum: ["OK"] } },
  required: ["status"],
  additionalProperties: false,
} satisfies Record<string, unknown>;
const preflightValidator = z.object({ status: z.literal("OK") }).strict();

/**
 * @description Performs the default gemini sdk loader helper operation for this module.
 * @returns {Promise<GeminiSdkModule>} Result of the default gemini sdk loader operation.
 */
async function defaultGeminiSdkLoader(): Promise<GeminiSdkModule> {
  return (await import(googleGenAiPackageName)) as GeminiSdkModule;
}

/**
 * @description Performs the delay helper operation for this module.
 * @param {number} milliseconds - Input value for milliseconds.
 * @returns {Promise<void>} Result of the delay operation.
 */
function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * @description Executes the get error status operation used by the application workflow.
 * @param {unknown} error - Input value for error.
 * @returns {number | undefined} Result of the get error status operation.
 */
function getErrorStatus(error: unknown): number | undefined {
  const candidates = [
    (error as { readonly status?: unknown }).status,
    (error as { readonly statusCode?: unknown }).statusCode,
    (error as { readonly code?: unknown }).code,
    (error as { readonly response?: { readonly status?: unknown } }).response?.status,
  ];
  return candidates.find((candidate): candidate is number => typeof candidate === "number");
}

/**
 * @description Executes the get provider message operation used by the application workflow.
 * @param {unknown} error - Input value for error.
 * @returns {string | undefined} Result of the get provider message operation.
 */
function getProviderMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  const objectMessage = (error as { readonly message?: unknown }).message;
  if (typeof objectMessage === "string") {
    return objectMessage;
  }
  return undefined;
}

/**
 * @description Performs the redact secret from message helper operation for this module.
 * @param {string | undefined} message - Input value for message.
 * @param {string} secret - Input value for secret.
 * @returns {string | undefined} Result of the redact secret from message operation.
 */
function redactSecretFromMessage(message: string | undefined, secret: string): string | undefined {
  if (!message) {
    return undefined;
  }

  let redacted = message;
  if (secret) {
    redacted = redacted.split(secret).join("[REDACTED]");
  }
  return redacted.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]");
}

/**
 * @description Performs the parse json object helper operation for this module.
 * @param {string | undefined} value - Input value for value.
 * @returns {Record<string, unknown> | null} Result of the parse json object operation.
 */
function parseJsonObject(value: string | undefined): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return unknownRecord(parsed);
  } catch {
    return null;
  }
}

/**
 * @description Performs the nested error object helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {Record<string, unknown> | null} Result of the nested error object operation.
 */
function nestedErrorObject(error: unknown): Record<string, unknown> | null {
  const record = unknownRecord(error);
  const responseData = unknownRecord(unknownRecord(record?.response)?.data);
  const responseError = unknownRecord(responseData?.error);
  if (responseError) {
    return responseError;
  }
  const directError = unknownRecord(record?.error);
  if (directError) {
    return directError;
  }
  const messageError = unknownRecord(parseJsonObject(getProviderMessage(error))?.error);
  return messageError;
}

/**
 * @description Executes the retry after header milliseconds operation used by the application workflow.
 * @param {unknown} error - Input value for error.
 * @returns {number | null} Result of the retry after header milliseconds operation.
 */
function retryAfterHeaderMilliseconds(error: unknown): number | null {
  const headers =
    unknownRecord(unknownRecord(error)?.response)?.headers ?? unknownRecord(error)?.headers;
  if (!headers) {
    return null;
  }
  let rawValue: unknown;
  if (typeof (headers as { readonly get?: unknown }).get === "function") {
    rawValue = (headers as { readonly get: (name: string) => unknown }).get("retry-after");
  } else {
    rawValue =
      (headers as Record<string, unknown>)["retry-after"] ??
      (headers as Record<string, unknown>)["Retry-After"];
  }
  if (typeof rawValue !== "string") {
    return null;
  }
  const seconds = Number(rawValue);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.round(seconds * 1000));
  }
  const dateMilliseconds = Date.parse(rawValue);
  if (Number.isFinite(dateMilliseconds)) {
    return Math.max(0, dateMilliseconds - Date.now());
  }
  return null;
}

/**
 * @description Executes the retry info milliseconds operation used by the application workflow.
 * @param {readonly unknown[]} details - Input value for details.
 * @returns {number | null} Result of the retry info milliseconds operation.
 */
function retryInfoMilliseconds(details: readonly unknown[]): number | null {
  for (const detail of details) {
    const record = unknownRecord(detail);
    if (!record || !String(record["@type"] ?? "").includes("RetryInfo")) {
      continue;
    }
    const retryDelay = record.retryDelay;
    if (typeof retryDelay === "string") {
      const match = /^(\d+(?:\.\d+)?)s$/.exec(retryDelay.trim());
      if (match) {
        return Math.round(Number(match[1]) * 1000);
      }
    }
    const retryDelayObject = unknownRecord(retryDelay);
    if (retryDelayObject) {
      const seconds = Number(retryDelayObject.seconds ?? 0);
      const nanos = Number(retryDelayObject.nanos ?? 0);
      if (Number.isFinite(seconds) && Number.isFinite(nanos)) {
        return Math.round(seconds * 1000 + nanos / 1_000_000);
      }
    }
  }
  return null;
}

/**
 * @description Performs the first quota violation helper operation for this module.
 * @param {readonly unknown[]} details - Input value for details.
 * @returns {Record<string, unknown> | null} Result of the first quota violation operation.
 */
function firstQuotaViolation(details: readonly unknown[]): Record<string, unknown> | null {
  for (const detail of details) {
    const record = unknownRecord(detail);
    if (!record || !String(record["@type"] ?? "").includes("QuotaFailure")) {
      continue;
    }
    const violations = record.violations;
    if (Array.isArray(violations)) {
      const violation = violations.map(unknownRecord).find((item) => item !== null);
      if (violation) {
        return violation;
      }
    }
  }
  return null;
}

/**
 * @description Performs the quota category helper operation for this module.
 * @param {{ readonly statusName: string | null; readonly message: string; readonly quotaMetric: string | null; readonly quotaId: string | null; }} input - Input value for input.
 * @returns {GeminiQuotaCategory} Result of the quota category operation.
 */
function quotaCategory(input: {
  readonly statusName: string | null;
  readonly message: string;
  readonly quotaMetric: string | null;
  readonly quotaId: string | null;
}): GeminiQuotaCategory {
  const text = [input.statusName, input.message, input.quotaMetric, input.quotaId]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  if (/tokens?.*(minute|min)|token.*per.*minute|tpm/.test(text)) {
    return "TOKENS_PER_MINUTE";
  }
  if (/(requests?|generate).*per.*(day|daily)|requests?_per_day|rpd|free_tier.*day/.test(text)) {
    return "REQUESTS_PER_DAY";
  }
  if (/(requests?|generate).*per.*(minute|min)|requests?_per_minute|rpm/.test(text)) {
    return "REQUESTS_PER_MINUTE";
  }
  if (/concurrent/.test(text)) {
    return "CONCURRENT_REQUESTS";
  }
  if (/capacity|overloaded|temporar/.test(text)) {
    return "TEMPORARY_CAPACITY";
  }
  return "UNKNOWN_QUOTA";
}

/**
 * @description Performs the string record helper operation for this module.
 * @param {unknown} value - Input value for value.
 * @returns {Record<string, string> | null} Result of the string record operation.
 */
function stringRecord(value: unknown): Record<string, string> | null {
  const record = unknownRecord(value);
  if (!record) {
    return null;
  }
  const entries = Object.entries(record)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .sort(([left], [right]) => left.localeCompare(right));
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/**
 * @description Performs the parse gemini quota error helper operation for this module.
 * @param {{ readonly error: unknown; readonly operation: string; readonly model: string; readonly sanitizedMessage?: string; }} input - Input value for input.
 * @returns {GeminiQuotaError | null} Result of the parse gemini quota error operation.
 */
export function parseGeminiQuotaError(input: {
  readonly error: unknown;
  readonly operation: string;
  readonly model: string;
  readonly sanitizedMessage?: string;
}): GeminiQuotaError | null {
  const status = getErrorStatus(input.error);
  if (status !== 429) {
    return null;
  }
  const errorObject = nestedErrorObject(input.error);
  const details = Array.isArray(errorObject?.details) ? errorObject.details : [];
  const violation = firstQuotaViolation(details);
  const quotaMetric = typeof violation?.quotaMetric === "string" ? violation.quotaMetric : null;
  const quotaId = typeof violation?.quotaId === "string" ? violation.quotaId : null;
  const message =
    (typeof errorObject?.message === "string" ? errorObject.message : input.sanitizedMessage) ?? "";
  const category = quotaCategory({
    statusName: typeof errorObject?.status === "string" ? errorObject.status : null,
    message,
    quotaMetric,
    quotaId,
  });
  return {
    category,
    retryable: category !== "REQUESTS_PER_DAY",
    retryAfterMilliseconds:
      retryAfterHeaderMilliseconds(input.error) ?? retryInfoMilliseconds(details),
    quotaMetric,
    quotaId,
    quotaDimensions: stringRecord(violation?.quotaDimensions),
    model: input.model,
    operation: input.operation,
  };
}

/**
 * @description Performs the normalize gemini model name helper operation for this module.
 * @param {string} name - Input value for name.
 * @returns {string} Result of the normalize gemini model name operation.
 */
export function normalizeGeminiModelName(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith("models/") ? trimmed.slice("models/".length) : trimmed;
}

/**
 * @description Performs the unique model names helper operation for this module.
 * @param {readonly string[]} names - Input value for names.
 * @returns {readonly string[]} Result of the unique model names operation.
 */
function uniqueModelNames(names: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const name of names) {
    const normalized = normalizeGeminiModelName(name);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

/**
 * @description Performs the unknown record helper operation for this module.
 * @param {unknown} value - Input value for value.
 * @returns {Record<string, unknown> | null} Result of the unknown record operation.
 */
function unknownRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/**
 * @description Performs the string array field helper operation for this module.
 * @param {Record<string, unknown>} record - Input value for record.
 * @param {string} field - Input value for field.
 * @returns {readonly string[] | null} Result of the string array field operation.
 */
function stringArrayField(
  record: Record<string, unknown>,
  field: string,
): readonly string[] | null {
  const value = record[field];
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * @description Performs the supports generate content helper operation for this module.
 * @param {unknown} model - Input value for model.
 * @returns {boolean | null} Result of the supports generate content operation.
 */
export function supportsGenerateContent(model: unknown): boolean | null {
  const record = unknownRecord(model);
  if (!record) {
    return null;
  }

  const supportedActions = stringArrayField(record, "supportedActions");
  if (supportedActions && supportedActions.length > 0) {
    return supportedActions.some((action) => action.toLowerCase() === "generatecontent");
  }

  const supportedGenerationMethods = stringArrayField(record, "supportedGenerationMethods");
  if (supportedGenerationMethods && supportedGenerationMethods.length > 0) {
    return supportedGenerationMethods.some((action) => action.toLowerCase() === "generatecontent");
  }

  return null;
}

/**
 * @description Performs the classify gemini doctor error helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {GeminiErrorCategory} Result of the classify gemini doctor error operation.
 */
export function classifyGeminiDoctorError(error: unknown): GeminiErrorCategory {
  const details =
    error instanceof ExternalServiceError
      ? (error.details as {
          readonly status?: unknown;
          readonly message?: unknown;
          readonly validationIssues?: unknown;
          readonly operationName?: unknown;
        })
      : undefined;
  const status = typeof details?.status === "number" ? details.status : getErrorStatus(error);
  const message =
    typeof details?.message === "string" ? details.message : getProviderMessage(error);

  if (/API_KEY_INVALID|api key not valid|invalid api key|unauth/i.test(message ?? "")) {
    return "AUTHENTICATION_ERROR";
  }
  if (status === 401 || status === 403) {
    return "AUTHENTICATION_ERROR";
  }
  if (status === 404) {
    return "MODEL_NOT_AVAILABLE";
  }
  if (status === 429) {
    return "RATE_LIMITED";
  }
  if (status === 400 && details?.operationName === "gemini_structured_output_preflight") {
    return "SCHEMA_NOT_SUPPORTED";
  }
  if (details?.validationIssues || /not valid JSON|schema validation/i.test(message ?? "")) {
    return "INVALID_RESPONSE";
  }
  if (/fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|network/i.test(message ?? "")) {
    return "NETWORK_ERROR";
  }
  return "UNKNOWN_ERROR";
}

/**
 * @description Performs the classify gemini structured llm error helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @param {unknown} operationName - Input value for operation name.
 * @param {unknown} model - Input value for model.
 * @returns {ClassifiedGeminiError} Result of the classify gemini structured llm error operation.
 */
export function classifyGeminiStructuredLlmError(
  error: unknown,
  operationName = "unknown",
  model = "unknown",
): ClassifiedGeminiError {
  if (error instanceof ExternalServiceError && typeof error.details.retryable === "boolean") {
    const providerMessage = getProviderMessage(error);
    return {
      retryable: error.details.retryable,
      ...(providerMessage ? { providerMessage } : {}),
      ...(error.details.validationIssues
        ? { validationIssues: error.details.validationIssues }
        : {}),
    };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return {
      retryable: true,
      providerMessage: error.message,
    };
  }

  const status = getErrorStatus(error);
  if (status !== undefined) {
    const providerMessage = getProviderMessage(error);
    const quotaError = parseGeminiQuotaError({
      error,
      operation: operationName,
      model,
      ...(providerMessage ? { sanitizedMessage: providerMessage } : {}),
    });
    return {
      status,
      retryable:
        quotaError?.retryable ??
        (retryableStatusCodes.has(status) || (status >= 500 && !permanentStatusCodes.has(status))),
      ...(providerMessage ? { providerMessage } : {}),
      ...(quotaError ? { quotaError } : {}),
    };
  }

  const providerMessage = getProviderMessage(error);
  return {
    retryable: true,
    ...(providerMessage ? { providerMessage } : {}),
  };
}

/**
 * @description Performs the extract response text helper operation for this module.
 * @param {unknown} response - Input value for response.
 * @returns {string} Result of the extract response text operation.
 */
function extractResponseText(response: unknown): string {
  const text = (response as { readonly text?: unknown }).text;
  if (typeof text === "string") {
    return text.trim();
  }
  if (typeof text === "function") {
    const functionText = text.call(response);
    return typeof functionText === "string" ? functionText.trim() : "";
  }

  const candidates = (response as { readonly candidates?: unknown[] }).candidates;
  const firstCandidate = candidates?.[0] as
    { readonly content?: { readonly parts?: readonly { readonly text?: unknown }[] } } | undefined;
  const partText = firstCandidate?.content?.parts
    ?.map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
  return partText?.trim() ?? "";
}

/**
 * @description Performs the collect async iterable helper operation for this module.
 * @param {AsyncIterable<unknown>} value - Input value for value.
 * @returns {Promise<unknown[]>} Result of the collect async iterable operation.
 */
async function collectAsyncIterable(value: AsyncIterable<unknown>): Promise<unknown[]> {
  const output: unknown[] = [];
  for await (const item of value) {
    output.push(item);
  }
  return output;
}

/**
 * @description Performs the collect model list response helper operation for this module.
 * @param {unknown} response - Input value for response.
 * @returns {Promise<unknown[]>} Result of the collect model list response operation.
 */
async function collectModelListResponse(response: unknown): Promise<unknown[]> {
  if (Array.isArray(response)) {
    return response;
  }
  if (response && typeof response === "object") {
    const page = (response as { readonly page?: unknown }).page;
    if (Array.isArray(page)) {
      return page;
    }
    const models = (response as { readonly models?: unknown }).models;
    if (Array.isArray(models)) {
      return models;
    }
    if (Symbol.asyncIterator in response) {
      return collectAsyncIterable(response as AsyncIterable<unknown>);
    }
  }
  return [];
}

/**
 * @description Performs the to gemini model summary helper operation for this module.
 * @param {unknown} model - Input value for model.
 * @returns {GeminiModelSummary | null} Result of the to gemini model summary operation.
 */
function toGeminiModelSummary(model: unknown): GeminiModelSummary | null {
  const record = unknownRecord(model);
  if (!record) {
    return null;
  }

  const rawName = record?.name;
  if (typeof rawName !== "string" || !rawName.trim()) {
    return null;
  }

  const actions = stringArrayField(record, "supportedActions") ?? [];
  return {
    name: normalizeGeminiModelName(rawName),
    supportsGenerateContent: supportsGenerateContent(model),
    supportedActions: actions,
  };
}

/**
 * @description Performs the with signal helper operation for this module.
 * @param {Record<string, unknown>} request - Input value for request.
 * @param {AbortSignal} signal - Input value for signal.
 * @returns {Record<string, unknown>} Result of the with signal operation.
 */
function withSignal(
  request: Record<string, unknown>,
  signal?: AbortSignal,
): Record<string, unknown> {
  if (!signal) {
    return request;
  }
  return {
    ...request,
    signal,
    abortSignal: signal,
  };
}

export class GeminiStructuredLlmClient
  implements
    StructuredLlmPreflightClient,
    StructuredLlmMetricsProvider,
    StructuredLlmRequestBudgetProvider
{
  private readonly apiKey: string;
  private readonly configuredModel: string | undefined;
  private readonly candidateModels: readonly string[];
  private readonly requestTimeoutMilliseconds: number;
  private readonly maxAttempts: number;
  private readonly maxRequestsPerContract: number;
  private readonly configuredMinRequestIntervalMilliseconds: number;
  private readonly maxQuotaRetries: number;
  private readonly maxRetryDelayMilliseconds: number;
  private readonly maxBatchOutputTokens: number;
  private readonly logger: Logger;
  private readonly sdkLoader: GeminiSdkLoader;
  private readonly delay: Delay;
  private client: GeminiSdkClient | null = null;
  private selectedModel: string | null = null;
  private selectedModelResult: ModelSelectionResult | null = null;
  private lastRequestStartedAt = 0;
  private adaptiveMinRequestIntervalMilliseconds = 0;
  private requestCount = 0;
  private retryCount = 0;
  private quotaRetryCount = 0;
  private quotaWaitMilliseconds = 0;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {GeminiStructuredLlmClientDependencies} dependencies - Input value for dependencies.
   * @returns {unknown} Result of the constructor operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  constructor(dependencies: GeminiStructuredLlmClientDependencies) {
    if (!dependencies.env.GEMINI_API_KEY) {
      throw new ExternalServiceError("Gemini API key is required for structured LLM calls", {
        missingConfiguration: "GEMINI_API_KEY",
        retryable: false,
      });
    }

    this.apiKey = dependencies.env.GEMINI_API_KEY;
    this.configuredModel = dependencies.env.GEMINI_MODEL
      ? normalizeGeminiModelName(dependencies.env.GEMINI_MODEL)
      : undefined;
    this.candidateModels = uniqueModelNames([
      ...(this.configuredModel ? [this.configuredModel] : []),
      ...(dependencies.modelCandidates ?? DEFAULT_FREE_MODEL_CANDIDATES),
    ]);
    this.requestTimeoutMilliseconds = dependencies.env.GEMINI_REQUEST_TIMEOUT_MS;
    this.maxAttempts = dependencies.env.GEMINI_MAX_ATTEMPTS;
    this.maxRequestsPerContract = dependencies.env.GEMINI_MAX_REQUESTS_PER_CONTRACT;
    this.configuredMinRequestIntervalMilliseconds = dependencies.env.GEMINI_MIN_REQUEST_INTERVAL_MS;
    this.adaptiveMinRequestIntervalMilliseconds = this.configuredMinRequestIntervalMilliseconds;
    this.maxQuotaRetries = dependencies.env.GEMINI_MAX_QUOTA_RETRIES;
    this.maxRetryDelayMilliseconds = dependencies.env.GEMINI_MAX_RETRY_DELAY_MS;
    this.maxBatchOutputTokens = dependencies.env.GEMINI_MAX_BATCH_OUTPUT_TOKENS;
    this.logger = dependencies.logger;
    this.sdkLoader = dependencies.sdkLoader ?? defaultGeminiSdkLoader;
    this.delay = dependencies.delay ?? delay;
  }

  /**
   * @description Implements the preflight method for this service or adapter.
   * @param {AbortSignal} signal - Input value for signal.
   * @returns {Promise<void>} Result of the preflight operation.
   */
  async preflight(signal?: AbortSignal): Promise<void> {
    await this.selectUsableModel(signal);
  }

  /**
   * @description Executes the get selected model operation used by the application workflow.
   * @returns {string | null} Result of the get selected model operation.
   */
  getSelectedModel(): string | null {
    return this.selectedModel;
  }

  /**
   * @description Executes the get candidate models operation used by the application workflow.
   * @returns {readonly string[]} Result of the get candidate models operation.
   */
  getCandidateModels(): readonly string[] {
    return this.candidateModels;
  }

  /**
   * @description Implements the select usable model method for this service or adapter.
   * @param {AbortSignal} signal - Input value for signal.
   * @returns {Promise<ModelSelectionResult>} Result of the select usable model operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async selectUsableModel(signal?: AbortSignal): Promise<ModelSelectionResult> {
    if (this.selectedModelResult) {
      return this.selectedModelResult;
    }

    const models = await this.listModelsForSelection(signal);
    const listedModels = models.map((model) => model.name).sort();
    const generateContentCapableModels = models
      .filter((model) => model.supportsGenerateContent === true)
      .map((model) => model.name)
      .sort();
    const listingHadSupportedActions = models.some((model) => model.supportedActions.length > 0);
    const listedModelSet = new Set(listedModels);
    const attemptedModels: ModelSelectionAttempt[] = [];

    for (const candidate of this.candidateModels) {
      const candidateListed = listedModelSet.has(candidate);
      if (listedModels.length > 0 && !candidateListed) {
        attemptedModels.push({ model: candidate, outcome: "NOT_LISTED" });
      }

      try {
        await this.runStructuredOutputPreflightForModel(candidate, signal);
        const selectedAttempt: ModelSelectionAttempt = {
          model: candidate,
          outcome: "SELECTED",
        };
        attemptedModels.push(selectedAttempt);
        const result: ModelSelectionResult = {
          selectedModel: candidate,
          selectionSource: this.selectionSourceFor(candidate, candidateListed),
          listedModels,
          generateContentCapableModels,
          listingSucceeded: true,
          listingHadSupportedActions,
          attemptedModels,
        };
        this.selectedModel = candidate;
        this.selectedModelResult = result;
        return result;
      } catch (error) {
        const errorCategory = classifyGeminiDoctorError(error);
        if (
          ["AUTHENTICATION_ERROR", "RATE_LIMITED", "NETWORK_ERROR", "UNKNOWN_ERROR"].includes(
            errorCategory,
          )
        ) {
          throw error;
        }

        attemptedModels.push({
          model: candidate,
          outcome:
            errorCategory === "MODEL_NOT_AVAILABLE"
              ? "MODEL_NOT_FOUND"
              : "STRUCTURED_OUTPUT_FAILED",
          errorCategory,
        });
      }
    }

    throw new ExternalServiceError("No usable Gemini model candidate passed structured preflight", {
      retryable: false,
      listedModels,
      generateContentCapableModels,
      attemptedModels,
    });
  }

  /**
   * @description Executes the list generate content models operation used by the application workflow.
   * @param {AbortSignal} signal - Input value for signal.
   * @returns {Promise<readonly GeminiModelSummary[]>} Result of the list generate content models operation.
   */
  async listGenerateContentModels(signal?: AbortSignal): Promise<readonly GeminiModelSummary[]> {
    const models = await this.listModelsForSelection(signal);
    return models.filter((model) => model.supportsGenerateContent !== false);
  }

  /**
   * @description Implements the generate structured method for this service or adapter.
   * @param {StructuredLlmRequest<T>} request - Input value for request.
   * @returns {Promise<T>} Result of the generate structured operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async generateStructured<T>(request: StructuredLlmRequest<T>): Promise<T> {
    const selectedModel = (await this.selectUsableModel(request.signal)).selectedModel;
    return this.withRetries(
      request.operationName,
      selectedModel,
      request.signal,
      async (attemptSignal) => {
        const client = await this.getClient();
        const response = await this.callGemini(request.operationName, () =>
          client.models.generateContent(
            this.buildGenerateContentRequest({
              model: selectedModel,
              systemInstruction: request.systemInstruction,
              prompt: request.prompt,
              jsonSchema: request.jsonSchema,
              ...(request.maxOutputTokens !== undefined
                ? { maxOutputTokens: request.maxOutputTokens }
                : {}),
              signal: attemptSignal,
            }),
          ),
        );
        const rawText = extractResponseText(response);
        if (!rawText) {
          throw new ExternalServiceError("Gemini structured generation returned no text", {
            operationName: request.operationName,
            retryable: true,
          });
        }
        return validateStructuredData(
          parseStructuredJson(rawText, request.operationName),
          request.validator,
          request.operationName,
        );
      },
    );
  }

  /**
   * @description Executes the get metrics snapshot operation used by the application workflow.
   * @returns {StructuredLlmMetricsSnapshot} Result of the get metrics snapshot operation.
   */
  getMetricsSnapshot(): StructuredLlmMetricsSnapshot {
    return {
      retryCount: this.retryCount,
      requestCount: this.requestCount,
      quotaRetryCount: this.quotaRetryCount,
      quotaWaitMilliseconds: this.quotaWaitMilliseconds,
    };
  }

  /**
   * @description Implements the reset request budget scope method for this service or adapter.
   * @returns {void} Result of the reset request budget scope operation.
   */
  resetRequestBudgetScope(): void {
    this.requestCount = 0;
    this.retryCount = 0;
    this.quotaRetryCount = 0;
    this.quotaWaitMilliseconds = 0;
    this.adaptiveMinRequestIntervalMilliseconds = this.configuredMinRequestIntervalMilliseconds;
    this.lastRequestStartedAt = 0;
  }

  /**
   * @description Implements the selection source for method for this service or adapter.
   * @param {string} candidate - Input value for candidate.
   * @param {boolean} candidateListed - Input value for candidate listed.
   * @returns {ModelSelectionResult["selectionSource"]} Result of the selection source for operation.
   */
  private selectionSourceFor(
    candidate: string,
    candidateListed: boolean,
  ): ModelSelectionResult["selectionSource"] {
    if (this.configuredModel && candidate === this.configuredModel) {
      return "CONFIGURED_MODEL";
    }
    return candidateListed ? "LISTED_CANDIDATE" : "DIRECT_PREFLIGHT";
  }

  /**
   * @description Executes the list models for selection operation used by the application workflow.
   * @param {AbortSignal} signal - Input value for signal.
   * @returns {Promise<readonly GeminiModelSummary[]>} Result of the list models for selection operation.
   */
  private async listModelsForSelection(
    signal?: AbortSignal,
  ): Promise<readonly GeminiModelSummary[]> {
    return this.withRetries("gemini_models_list", "model-list", signal, async (attemptSignal) => {
      const client = await this.getClient();
      if (!client.models.list) {
        return [];
      }

      const response = await this.callGemini(
        "gemini_models_list",
        () =>
          client.models.list?.(withSignal({ config: { pageSize: 100 } }, attemptSignal)) ??
          Promise.resolve([]),
      );
      const models = await collectModelListResponse(response);
      return models.flatMap((model) => {
        const summary = toGeminiModelSummary(model);
        if (!summary || summary.supportsGenerateContent === false) {
          return [];
        }
        return [summary];
      });
    });
  }

  /**
   * @description Implements the run structured output preflight for model method for this service or adapter.
   * @param {string} model - Input value for model.
   * @param {AbortSignal} signal - Input value for signal.
   * @returns {Promise<void>} Result of the run structured output preflight for model operation.
   */
  private async runStructuredOutputPreflightForModel(
    model: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.withRetries(
      "gemini_structured_output_preflight",
      model,
      signal,
      async (attemptSignal) => {
        const client = await this.getClient();
        const response = await this.callGemini("gemini_structured_output_preflight", () =>
          client.models.generateContent(
            this.buildGenerateContentRequest({
              model,
              systemInstruction: "Return only the requested structured response.",
              prompt: "Return status OK.",
              jsonSchema: preflightJsonSchema,
              maxOutputTokens: 32,
              signal: attemptSignal,
            }),
          ),
        );
        validateStructuredData(
          parseStructuredJson(extractResponseText(response), "gemini_structured_output_preflight"),
          preflightValidator,
          "gemini_structured_output_preflight",
        );
      },
    );
  }

  /**
   * @description Executes the get client operation used by the application workflow.
   * @returns {Promise<GeminiSdkClient>} Result of the get client operation.
   */
  private async getClient(): Promise<GeminiSdkClient> {
    if (!this.client) {
      const sdk = await this.sdkLoader();
      this.client = new sdk.GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  /**
   * @description Implements the build generate content request method for this service or adapter.
   * @param {{ readonly model: string; readonly systemInstruction: string; readonly prompt: string; readonly jsonSchema: Record<string, unknown>; readonly maxOutputTokens?: number; readonly signal?: AbortSignal; }} input - Input value for input.
   * @returns {Record<string, unknown>} Result of the build generate content request operation.
   */
  private buildGenerateContentRequest(input: {
    readonly model: string;
    readonly systemInstruction: string;
    readonly prompt: string;
    readonly jsonSchema: Record<string, unknown>;
    readonly maxOutputTokens?: number;
    readonly signal?: AbortSignal;
  }): Record<string, unknown> {
    const config: Record<string, unknown> = {
      systemInstruction: input.systemInstruction,
      responseMimeType: "application/json",
      responseSchema: input.jsonSchema,
    };
    if (input.maxOutputTokens !== undefined) {
      config.maxOutputTokens = input.maxOutputTokens;
    }

    return withSignal(
      {
        model: input.model,
        contents: input.prompt,
        config,
      },
      input.signal,
    );
  }

  /**
   * @description Implements the call gemini method for this service or adapter.
   * @param {string} operationName - Input value for operation name.
   * @param {() => Promise<T>} operation - Input value for operation.
   * @returns {Promise<T>} Result of the call gemini operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  private async callGemini<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
    if (this.requestCount >= this.maxRequestsPerContract) {
      throw new ExternalServiceError("GEMINI_CONTRACT_REQUEST_BUDGET_EXCEEDED", {
        code: "GEMINI_CONTRACT_REQUEST_BUDGET_EXCEEDED",
        operationName,
        retryable: false,
        maxRequestsPerContract: this.maxRequestsPerContract,
        requestCount: this.requestCount,
      });
    }
    await this.waitForMinimumRequestInterval();
    this.lastRequestStartedAt = Date.now();
    this.requestCount += 1;
    this.logger.info("gemini_structured_llm_request", {
      operationName,
      requestCount: this.requestCount,
      maxRequestsPerContract: this.maxRequestsPerContract,
    });
    return operation();
  }

  /**
   * @description Implements the wait for minimum request interval method for this service or adapter.
   * @returns {Promise<void>} Result of the wait for minimum request interval operation.
   */
  private async waitForMinimumRequestInterval(): Promise<void> {
    if (this.adaptiveMinRequestIntervalMilliseconds <= 0 || this.lastRequestStartedAt === 0) {
      return;
    }

    const elapsed = Date.now() - this.lastRequestStartedAt;
    const remaining = this.adaptiveMinRequestIntervalMilliseconds - elapsed;
    if (remaining > 0) {
      await this.delay(remaining);
    }
  }

  /**
   * @description Implements the can retry method for this service or adapter.
   * @param {ClassifiedGeminiError} classification - Input value for classification.
   * @param {number} attempt - Input value for attempt.
   * @returns {boolean} Result of the can retry operation.
   */
  private canRetry(classification: ClassifiedGeminiError, attempt: number): boolean {
    if (classification.quotaError) {
      return this.quotaRetryCount < this.maxQuotaRetries;
    }
    return attempt < this.maxAttempts;
  }

  /**
   * @description Implements the next quota retry delay method for this service or adapter.
   * @param {GeminiQuotaError} quotaError - Input value for quota error.
   * @param {number} retryIndex - Input value for retry index.
   * @returns {number} Result of the next quota retry delay operation.
   */
  private nextQuotaRetryDelay(quotaError: GeminiQuotaError, retryIndex: number): number {
    if (quotaError.category === "REQUESTS_PER_MINUTE") {
      this.adaptiveMinRequestIntervalMilliseconds = Math.min(
        this.maxRetryDelayMilliseconds,
        Math.max(
          this.configuredMinRequestIntervalMilliseconds,
          Math.ceil(this.adaptiveMinRequestIntervalMilliseconds * 1.5),
        ),
      );
    }

    const minimumDelay = Math.max(
      this.configuredMinRequestIntervalMilliseconds,
      this.adaptiveMinRequestIntervalMilliseconds,
    );
    const serverDelay = quotaError.retryAfterMilliseconds;
    if (serverDelay !== null) {
      return Math.min(this.maxRetryDelayMilliseconds, Math.max(minimumDelay, serverDelay));
    }

    const exponential = minimumDelay * 2 ** Math.max(0, retryIndex - 1);
    const jitter = Math.round(minimumDelay * 0.15 * Math.random());
    return Math.min(this.maxRetryDelayMilliseconds, Math.max(minimumDelay, exponential + jitter));
  }

  /**
   * @description Implements the with retries method for this service or adapter.
   * @param {string} operationName - Input value for operation name.
   * @param {string} model - Input value for model.
   * @param {AbortSignal | undefined} signal - Input value for signal.
   * @param {(signal: AbortSignal) => Promise<T>} operation - Input value for operation.
   * @returns {Promise<T>} Result of the with retries operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  private async withRetries<T>(
    operationName: string,
    model: string,
    signal: AbortSignal | undefined,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    const maxLoopAttempts = Math.max(this.maxAttempts, this.maxQuotaRetries + 1);
    for (let attempt = 1; attempt <= maxLoopAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMilliseconds);

      /**
       * @description Performs the abort forwarder helper operation for this module.
       * @returns {unknown} Result of the abort forwarder operation.
       */
      const abortForwarder = () => controller.abort();
      signal?.addEventListener("abort", abortForwarder, { once: true });

      try {
        this.logger.info("gemini_structured_llm_attempt", {
          operationName,
          attempt,
          maxAttempts: this.maxAttempts,
        });
        return await operation(controller.signal);
      } catch (error) {
        lastError = error;
        if (
          error instanceof ExternalServiceError &&
          error.message === "GEMINI_CONTRACT_REQUEST_BUDGET_EXCEEDED"
        ) {
          throw error;
        }
        const classification = classifyGeminiStructuredLlmError(error, operationName, model);
        const redactedProviderMessage = redactSecretFromMessage(
          classification.providerMessage,
          this.apiKey,
        );
        this.logger.warn("gemini_structured_llm_attempt_failed", {
          operationName,
          model,
          attempt,
          maxAttempts: this.maxAttempts,
          retryable: classification.retryable,
          status: classification.status,
          message: redactedProviderMessage,
          quota: classification.quotaError,
        });

        if (classification.quotaError?.category === "REQUESTS_PER_DAY") {
          throw new ExternalServiceError("DAILY_QUOTA_EXHAUSTED", {
            operationName,
            retryable: false,
            attempts: attempt,
            status: classification.status,
            message: redactedProviderMessage,
            quota: classification.quotaError,
          });
        }

        if (!classification.retryable || !this.canRetry(classification, attempt)) {
          throw new ExternalServiceError("Gemini structured LLM request failed", {
            operationName,
            retryable: false,
            attempts: attempt,
            status: classification.status,
            message: redactedProviderMessage,
            ...(classification.quotaError ? { quota: classification.quotaError } : {}),
            ...(classification.validationIssues
              ? { validationIssues: classification.validationIssues }
              : {}),
          });
        }
        this.retryCount += 1;
        if (classification.quotaError) {
          this.quotaRetryCount += 1;
          const retryDelayMilliseconds = this.nextQuotaRetryDelay(
            classification.quotaError,
            this.quotaRetryCount,
          );
          this.quotaWaitMilliseconds += retryDelayMilliseconds;
          this.logger.warn("gemini_quota_retry_wait", {
            operationName,
            model,
            quota: classification.quotaError,
            retryDelayMilliseconds,
          });
          await this.delay(retryDelayMilliseconds);
        }
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abortForwarder);
      }
    }

    const classification = classifyGeminiStructuredLlmError(lastError, operationName, model);
    throw new ExternalServiceError("Gemini structured LLM request failed", {
      operationName,
      retryable: false,
      attempts: maxLoopAttempts,
      status: classification.status,
      message: redactSecretFromMessage(classification.providerMessage, this.apiKey),
      ...(classification.quotaError ? { quota: classification.quotaError } : {}),
      ...(classification.validationIssues
        ? { validationIssues: classification.validationIssues }
        : {}),
    });
  }
}
