/**
 * @file Defines backend notifications module contracts, services, routes, or persistence logic.
 */
import type { Logger } from "../../config/logger.js";
import type {
  NotificationInput,
  NotificationProvider,
  NotificationResult,
} from "./notifications.types.js";

export class ConsoleNotificationProvider implements NotificationProvider {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {Logger} logger - Input value for logger.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly logger: Logger) {}

  /**
   * @description Implements the send method for this service or adapter.
   * @param {NotificationInput} input - Input value for input.
   * @returns {Promise<NotificationResult>} Result of the send operation.
   */
  async send(input: NotificationInput): Promise<NotificationResult> {
    this.logger.info("notification_console_preview", {
      recipient: input.recipient,
      subject: input.subject,
      correlationId: input.correlationId,
    });
    return { status: "accepted" };
  }
}
