/**
 * @file Provides Brevo API email delivery for reminder notifications.
 */
import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { EmailInput, EmailProvider, EmailResult } from "./email-provider.js";

const brevoAccountEndpoint = "https://api.brevo.com/v3/account";
const brevoEmailEndpoint = "https://api.brevo.com/v3/smtp/email";

export interface BrevoEmailAdapterConfig {
  readonly apiKey: string;
  readonly senderEmail: string;
  readonly senderName: string;
  readonly accountEndpoint?: string;
  readonly emailEndpoint?: string;
}

export interface BrevoVerificationResult {
  readonly status: "verified";
  readonly account: unknown;
}

/**
 * @description Reads the JSON body from a Brevo API response when possible.
 * @param {Response} response - Fetch response returned by Brevo.
 * @returns {Promise<unknown>} Parsed JSON body or null when the body is empty.
 */
async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * @description Extracts a provider error message from a Brevo API response body.
 * @param {unknown} body - Parsed Brevo response body.
 * @returns {string | undefined} Error message returned by Brevo, if present.
 */
function brevoMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const message = (body as { readonly message?: unknown }).message;
  return typeof message === "string" && message.trim().length > 0 ? message : undefined;
}

/**
 * @description Converts a plain-text email body into a simple HTML fallback.
 * @param {string} bodyText - Plain-text notification body.
 * @returns {string} HTML body with escaped content and line breaks.
 */
function htmlFromText(bodyText: string): string {
  return bodyText
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br>");
}

/**
 * @description Extracts the Brevo message identifier from a send-email response body.
 * @param {unknown} body - Parsed Brevo send response body.
 * @returns {string | undefined} Provider message identifier when returned.
 */
function messageIdFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const messageId = (body as { readonly messageId?: unknown }).messageId;
  return typeof messageId === "string" && messageId.trim().length > 0 ? messageId : undefined;
}

export class BrevoEmailAdapter implements EmailProvider {
  /**
   * @description Creates a Brevo API adapter with sender identity and API credentials.
   * @param {BrevoEmailAdapterConfig} config - Brevo API key, sender identity, and optional endpoint overrides.
   * @returns {unknown} Constructed Brevo email adapter instance.
   */
  constructor(private readonly config: BrevoEmailAdapterConfig) {}

  /**
   * @description Verifies the configured Brevo API key by loading account metadata.
   * @returns {Promise<BrevoVerificationResult>} Verification status and raw account payload.
   * @throws {ExternalServiceError} When Brevo rejects the API key or the account endpoint fails.
   */
  async verifyAccount(): Promise<BrevoVerificationResult> {
    try {
      const response = await fetch(this.config.accountEndpoint ?? brevoAccountEndpoint, {
        method: "GET",
        headers: {
          "api-key": this.config.apiKey,
          Accept: "application/json",
        },
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new ExternalServiceError("Brevo API verification failed", {
          statusCode: response.status,
          reason: brevoMessage(data) ?? "Brevo account verification failed",
          response: data,
        });
      }

      return { status: "verified", account: data };
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError("Brevo API verification failed", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * @description Sends a notification email using the Brevo SMTP email API.
   * @param {EmailInput} input - Recipient, sender override, subject, text body, and HTML body.
   * @returns {Promise<EmailResult>} Accepted delivery status and provider message identifier.
   * @throws {ExternalServiceError} When Brevo rejects or fails the email request.
   */
  async send(input: EmailInput): Promise<EmailResult> {
    try {
      const response = await fetch(this.config.emailEndpoint ?? brevoEmailEndpoint, {
        method: "POST",
        headers: {
          "api-key": this.config.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: this.config.senderName,
            email: input.from ?? this.config.senderEmail,
          },
          to: [{ email: input.recipient }],
          subject: input.subject,
          htmlContent: input.bodyHtml ?? htmlFromText(input.bodyText),
          textContent: input.bodyText,
        }),
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new ExternalServiceError("Brevo email sending failed", {
          recipient: input.recipient,
          statusCode: response.status,
          reason: brevoMessage(data) ?? "Failed to send email",
          response: data,
        });
      }

      const providerMessageId = messageIdFromBody(data);
      return {
        status: "accepted",
        ...(providerMessageId ? { providerMessageId } : {}),
      };
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError("Brevo email sending failed", {
        recipient: input.recipient,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
