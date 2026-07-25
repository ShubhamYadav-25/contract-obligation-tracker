/**
 * @file Defines LLM infrastructure clients and structured response helpers.
 */
import type { ZodType } from "zod";

/**
 * @description Performs the parse structured response helper operation for this module.
 * @param {ZodType<T>} schema - Input value for schema.
 * @param {unknown} value - Input value for value.
 * @returns {T} Result of the parse structured response operation.
 */
export function parseStructuredResponse<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
