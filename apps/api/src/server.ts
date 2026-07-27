/**
 * @file Defines backend API application entrypoint or server composition code.
 */
import { createServer } from "node:http";

import { createGracefulShutdown } from "./bootstrap/graceful-shutdown.js";
import { registerSchedulers } from "./bootstrap/register-schedulers.js";
import { registerWorkers } from "./bootstrap/register-workers.js";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import { closeApplicationDatabase } from "./infrastructure/database/app-database.js";

const env = loadEnv();
const logger = createLogger(env);
const app = createApp();
const server = createServer(app);

const workerRegistry = registerWorkers({ logger });
const schedulerRegistry = registerSchedulers({ logger });
const shutdown = createGracefulShutdown({
  logger,
  resources: [
    server,
    workerRegistry,
    schedulerRegistry,
    { close: closeApplicationDatabase },
  ],
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

server.on("error", (error: NodeJS.ErrnoException) => {
  logger.error("api_listen_failed", {
    code: error.code,
    message: error.message,
    host: env.API_HOST,
    port: env.API_PORT,
  });
  process.exitCode = 1;
  void shutdown("SERVER_ERROR");
});

server.listen(env.API_PORT, env.API_HOST, () => {
  logger.info("api_started", { host: env.API_HOST, port: env.API_PORT });
});
