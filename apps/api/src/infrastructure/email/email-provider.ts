/**
 * @file Defines email delivery infrastructure contracts and adapters.
 */
import type {
  NotificationInput,
  NotificationProvider,
  NotificationResult,
} from "../../modules/notifications/notifications.types.js";

export type EmailProvider = NotificationProvider;
export type EmailInput = NotificationInput;
export type EmailResult = NotificationResult;
