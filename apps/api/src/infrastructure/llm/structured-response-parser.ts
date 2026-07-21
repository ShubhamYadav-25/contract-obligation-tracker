import type { ZodType } from "zod";

export function parseStructuredResponse<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
