/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import { pathToFileURL } from "node:url";

import { loadEnv } from "../config/env.js";
import { createLogger } from "../config/logger.js";
import { createGracefulShutdown } from "../bootstrap/graceful-shutdown.js";
import { registerWorkers } from "../bootstrap/register-workers.js";

/**
 * @description Executes the create worker runtime operation used by the application workflow.
 * @returns {unknown} Result of the create worker runtime operation.
 */
export function createWorkerRuntime() {
  const env = loadEnv();
  const logger = createLogger(env);
  const workerRegistry = registerWorkers({ logger });
  const shutdown = createGracefulShutdown({ logger, resources: [workerRegistry] });

  return { workerRegistry, shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runtime = createWorkerRuntime();

  process.on("SIGINT", () => {
    void runtime.shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void runtime.shutdown("SIGTERM");
  });
}
