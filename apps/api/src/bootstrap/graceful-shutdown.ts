import type { Server } from "node:http";

import type { Logger } from "../config/logger.js";

export interface CloseableResource {
  close(): Promise<void> | void;
}

export interface GracefulShutdownOptions {
  readonly logger: Logger;
  readonly resources: readonly (Server | CloseableResource)[];
}

function closeResource(resource: Server | CloseableResource): Promise<void> {
  return new Promise((resolve) => {
    if (resource.close.length > 0) {
      (resource as Server).close(() => resolve());
      return;
    }

    const closeResult = (resource as CloseableResource).close();
    if (closeResult instanceof Promise) {
      closeResult.then(resolve).catch(() => resolve());
    } else {
      resolve();
    }
  });
}

export function createGracefulShutdown(
  options: GracefulShutdownOptions,
): (signal: string) => Promise<void> {
  let shuttingDown = false;

  return async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    options.logger.info("shutdown_started", { signal });
    await Promise.all(options.resources.map((resource) => closeResource(resource)));
    options.logger.info("shutdown_completed", { signal });
  };
}
