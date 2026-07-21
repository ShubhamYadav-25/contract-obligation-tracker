import type { Logger } from "../config/logger.js";
import type { CloseableResource } from "./graceful-shutdown.js";

export interface SchedulerRegistry extends CloseableResource {
  readonly names: readonly string[];
}

export function registerSchedulers({ logger }: { readonly logger: Logger }): SchedulerRegistry {
  logger.info("schedulers_registered", { schedulers: [] });

  return {
    names: [],
    async close() {
      logger.info("schedulers_closed");
    },
  };
}
