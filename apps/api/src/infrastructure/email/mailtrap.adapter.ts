/**
 * @file Defines email delivery infrastructure contracts and adapters.
 */
import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { EmailInput, EmailProvider, EmailResult } from "./email-provider.js";

export class MailtrapEmailAdapter implements EmailProvider {
  /**
   * @description Implements the send method for this service or adapter.
   * @param {EmailInput} input - Input value for input.
   * @returns {Promise<EmailResult>} Result of the send operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async send(input: EmailInput): Promise<EmailResult> {
    throw new ExternalServiceError("Mailtrap email adapter is not wired yet", {
      recipient: input.recipient,
    });
  }
}
