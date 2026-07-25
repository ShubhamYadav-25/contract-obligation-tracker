/**
 * @file Defines backend messages module contracts, services, routes, or persistence logic.
 */
export { MessageController } from "./messages.controller.js";
export { PostgresMessageRepository } from "./postgres-message.repository.js";
export { createMessageRouter } from "./messages.routes.js";
export type { MessageReadRepository } from "./messages.repository.js";
export type { MessageRecord } from "./messages.types.js";
