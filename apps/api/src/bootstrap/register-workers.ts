import type { Logger } from "../config/logger.js";
import type { CloseableResource } from "./graceful-shutdown.js";

export interface WorkerRegistry extends CloseableResource {
  readonly names: readonly string[];
}

export function registerWorkers({ logger }: { readonly logger: Logger }): WorkerRegistry {
  logger.info("workers_registered", { workers: [] });

  return {
    names: [],
    async close() {
      logger.info("workers_closed");
    },
  };
}
