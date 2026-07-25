/**
 * @file Defines email delivery configuration derived from backend environment variables.
 */
import type { ApiEnv } from "./env.js";

export interface EmailConfig {
  readonly provider: ApiEnv["EMAIL_PROVIDER"];
  readonly from?: string;
  readonly fromName?: string;
  readonly defaultRecipient?: string;
  readonly brevo: {
    readonly apiKey?: string;
  };
  readonly smtp: {
    readonly host?: string;
    readonly port: number;
    readonly user?: string;
    readonly password?: string;
  };
}

/**
 * @description Builds normalized email delivery settings from parsed environment variables.
 * @param {ApiEnv} env - Parsed backend runtime environment.
 * @returns {EmailConfig} Provider, sender, recipient, and SMTP connection settings.
 */
export function createEmailConfig(env: ApiEnv): EmailConfig {
  const from = env.EMAIL_FROM_ADDRESS;
  const defaultRecipient = env.REMINDER_RECIPIENT_EMAIL ?? from;

  return {
    provider: env.EMAIL_PROVIDER,
    ...(from ? { from } : {}),
    ...(env.EMAIL_FROM_NAME ? { fromName: env.EMAIL_FROM_NAME } : {}),
    ...(defaultRecipient ? { defaultRecipient } : {}),
    brevo: {
      ...(env.BREVO_API_KEY ? { apiKey: env.BREVO_API_KEY } : {}),
    },
    smtp: {
      ...(env.SMTP_HOST ? { host: env.SMTP_HOST } : {}),
      port: env.SMTP_PORT,
      ...(env.SMTP_USER ? { user: env.SMTP_USER } : {}),
      ...(env.SMTP_PASSWORD ? { password: env.SMTP_PASSWORD } : {}),
    },
  };
}
