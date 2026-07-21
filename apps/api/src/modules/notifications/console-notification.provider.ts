import type { Logger } from "../../config/logger.js";
import type {
  NotificationInput,
  NotificationProvider,
  NotificationResult,
} from "./notifications.types.js";

export class ConsoleNotificationProvider implements NotificationProvider {
  constructor(private readonly logger: Logger) {}

  async send(input: NotificationInput): Promise<NotificationResult> {
    this.logger.info("notification_console_preview", {
      recipient: input.recipient,
      subject: input.subject,
      correlationId: input.correlationId,
    });
    return { status: "accepted" };
  }
}
