/**
 * @file Verifies Brevo email configuration and sends a local test email to EMAIL_FROM_ADDRESS.
 */
import { createEmailConfig } from "../config/email.js";
import { loadEnv } from "../config/env.js";
import { BrevoEmailAdapter } from "../infrastructure/email/brevo.adapter.js";
import { ApplicationError } from "../shared/errors/application-error.js";

/**
 * @description Runs the Brevo account verification and sends a smoke-test email to EMAIL_FROM_ADDRESS.
 * @returns {Promise<void>} Resolves after verification and test delivery complete.
 * @throws {Error} When email configuration is incomplete or Brevo rejects the request.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const emailConfig = createEmailConfig(env);

  if (!emailConfig.from) {
    throw new Error("EMAIL_FROM_ADDRESS is required to test Brevo email delivery");
  }
  if (!emailConfig.brevo.apiKey) {
    throw new Error("BREVO_API_KEY is required to test Brevo email delivery");
  }

  const adapter = new BrevoEmailAdapter({
    apiKey: emailConfig.brevo.apiKey,
    senderEmail: emailConfig.from,
    senderName: emailConfig.fromName ?? env.APP_NAME,
  });

  await adapter.verifyAccount();
  const result = await adapter.send({
    recipient: emailConfig.from,
    from: emailConfig.from,
    subject: "Contract Obligation Tracker email test",
    bodyText:
      "This is a Contract Obligation Tracker email delivery test sent to EMAIL_FROM_ADDRESS.",
    bodyHtml:
      '<div style="font-family:Inter,Arial,sans-serif;color:#0F172A"><h1 style="font-size:20px">Contract Obligation Tracker</h1><p>This is a Brevo email delivery test sent to <strong>EMAIL_FROM_ADDRESS</strong>.</p><p style="color:#00A878;font-weight:700">Email service verified.</p></div>',
  });

  console.log(
    JSON.stringify(
      {
        verified: true,
        testRecipient: "EMAIL_FROM_ADDRESS",
        status: result.status,
        providerMessageId: result.providerMessageId ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const details =
    error instanceof ApplicationError
      ? {
          statusCode: error.statusCode,
          code: error.code,
          details: error.details,
        }
      : {};
  console.error(
    JSON.stringify(
      {
        verified: false,
        error: error instanceof Error ? error.message : String(error),
        ...details,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
