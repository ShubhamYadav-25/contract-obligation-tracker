import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { EmailInput, EmailProvider, EmailResult } from "./email-provider.js";

export class MailtrapEmailAdapter implements EmailProvider {
  async send(input: EmailInput): Promise<EmailResult> {
    throw new ExternalServiceError("Mailtrap email adapter is not wired yet", {
      recipient: input.recipient,
    });
  }
}
