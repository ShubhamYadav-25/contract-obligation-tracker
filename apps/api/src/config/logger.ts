import type { ApiEnv } from "./env.js";

export interface Logger {
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
}

export function createLogger(env: Pick<ApiEnv, "LOG_FORMAT" | "LOG_LEVEL">): Logger {
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
