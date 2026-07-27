/**
 * @file Defines LLM infrastructure clients and structured response helpers.
 */
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

/**
 * @description Performs the clean json text helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {string} Result of the clean json text operation.
 */
function cleanJsonText(text: string): string {
  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    start = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
  }

  if (start >= 0) {
    const lastBrace = cleaned.lastIndexOf("}");
    const lastBracket = cleaned.lastIndexOf("]");
    const end = Math.max(lastBrace, lastBracket);
    if (end > start) {
      cleaned = cleaned.slice(start, end + 1);
    }
  }

  return cleaned;
}

/**
 * @description Performs the parse structured json helper operation for this module.
 * @param {string} text - Input value for text.
 * @param {string} operationName - Input value for operation name.
 * @returns {unknown} Result of the parse structured json operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
export function parseStructuredJson(text: string, operationName: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const cleaned = cleanJsonText(text);
      return JSON.parse(cleaned);
    } catch (error) {
      throw new ExternalServiceError("Structured LLM response was not valid JSON", {
        operationName,
        retryable: true,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * @description Performs the validate structured data helper operation for this module.
 * @param {unknown} value - Input value for value.
 * @param {ZodType<T>} validator - Input value for validator.
 * @param {string} operationName - Input value for operation name.
 * @returns {T} Result of the validate structured data operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
export function validateStructuredData<T>(
  value: unknown,
  validator: ZodType<T>,
  operationName: string,
): T {
  const result = validator.safeParse(value);
  if (!result.success) {
    throw new ExternalServiceError("Structured LLM response failed schema validation", {
      operationName,
      retryable: operationName !== "gemini_structured_output_preflight",
      validationIssues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    });
  }
  return result.data;
}

