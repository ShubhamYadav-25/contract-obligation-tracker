import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { EmailInput, EmailProvider, EmailResult } from "./email-provider.js";

export class ResendEmailAdapter implements EmailProvider {
  async send(input: EmailInput): Promise<EmailResult> {
    throw new ExternalServiceError("Resend email adapter is not wired yet", {
      recipient: input.recipient,
    });
  }
}
