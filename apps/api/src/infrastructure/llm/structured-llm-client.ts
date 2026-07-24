import type { ZodType } from "zod";

import { ExternalServiceError } from "../../shared/errors/external-service-error.js";

export interface StructuredLlmRequest<T> {
  readonly operationName: string;
  readonly systemInstruction: string;
  readonly prompt: string;
  readonly jsonSchema: Record<string, unknown>;
  readonly validator: ZodType<T>;
  readonly maxOutputTokens?: number;
  readonly timeoutMilliseconds?: number;
  readonly signal?: AbortSignal;
}

export interface StructuredLlmClient {
  generateStructured<T>(request: StructuredLlmRequest<T>): Promise<T>;
}

export interface StructuredLlmPreflightClient extends StructuredLlmClient {
  preflight(signal?: AbortSignal): Promise<void>;
}

export interface StructuredLlmMetricsSnapshot {
  readonly retryCount: number;
  readonly requestCount?: number;
  readonly quotaRetryCount?: number;
  readonly quotaWaitMilliseconds?: number;
}

export interface StructuredLlmMetricsProvider {
  getMetricsSnapshot(): StructuredLlmMetricsSnapshot;
}

export interface StructuredLlmRequestBudgetProvider {
  resetRequestBudgetScope(): void;
}

export function parseStructuredJson(text: string, operationName: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ExternalServiceError("Structured LLM response was not valid JSON", {
      operationName,
      retryable: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function validateStructuredData<T>(
  value: unknown,
  validator: ZodType<T>,
  operationName: string,
): T {
  const result = validator.safeParse(value);
  if (!result.success) {
    throw new ExternalServiceError("Structured LLM response failed schema validation", {
      operationName,
      retryable: false,
      validationIssues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    });
  }
  return result.data;
}
