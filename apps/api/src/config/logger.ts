/**
 * @file Defines backend runtime configuration and environment helpers.
 */
import type { ApiEnv } from "./env.js";

export interface Logger {
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
}

/**
 * @description Executes the create logger operation used by the application workflow.
 * @param {Pick<ApiEnv, "LOG_FORMAT" | "LOG_LEVEL">} env - Input value for env.
 * @returns {Logger} Result of the create logger operation.
 */
export function createLogger(env: Pick<ApiEnv, "LOG_FORMAT" | "LOG_LEVEL">): Logger {
  /**
   * @description Performs the write helper operation for this module.
   * @param {"info" | "warn" | "error"} level - Input value for level.
   * @param {string} message - Input value for message.
   * @param {Record<string, unknown>} details - Input value for details.
   * @returns {unknown} Result of the write operation.
   */
  const write = (
    level: "info" | "warn" | "error",
    message: string,
    details?: Record<string, unknown>,
  ) => {
    const payload = { level, message, ...details };
    if (env.LOG_FORMAT === "pretty") {
      console[level](`${level.toUpperCase()} ${message}`, details ?? {});
      return;
    }
    console[level](JSON.stringify(payload));
  };

  return {
    info: (message, details) => write("info", message, details),
    warn: (message, details) => write("warn", message, details),
    error: (message, details) => write("error", message, details),
  };
}
