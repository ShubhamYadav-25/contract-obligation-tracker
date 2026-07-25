/**
 * @file Builds reminder email subjects and bodies for contract obligation notifications.
 */
const millisecondsPerDay = 24 * 60 * 60 * 1_000;

export interface ReminderEmailTemplateInput {
  readonly appName: string;
  readonly contractName: string;
  readonly obligationTitle: string;
  readonly obligationDescription?: string | null;
  readonly responsibleParty?: string | null;
  readonly category?: string | null;
  readonly dueAt?: Date | null;
  readonly scheduledFor: Date;
  readonly now: Date;
  readonly contractUrl?: string;
}

export interface ReminderEmailTemplate {
  readonly subject: string;
  readonly bodyText: string;
  readonly bodyHtml: string;
  readonly daysRemaining?: number;
  readonly timingLabel: string;
}

/**
 * @description Escapes user-controlled content before placing it in an HTML email template.
 * @param {string} value - Raw text that may contain reserved HTML characters.
 * @returns {string} HTML-safe text.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * @description Formats dates into compact, locale-stable labels for notification content.
 * @param {Date} value - Date to format.
 * @returns {string} Human-readable date label.
 */
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

/**
 * @description Computes the remaining calendar days between now and the obligation due date.
 * @param {Date | null | undefined} dueAt - Obligation due date, when available.
 * @param {Date} now - Current timestamp used as the calculation baseline.
 * @returns {number | undefined} Signed number of days remaining, or undefined when no due date exists.
 */
export function calculateDaysRemaining(
  dueAt: Date | null | undefined,
  now: Date,
): number | undefined {
  if (!dueAt) {
    return undefined;
  }

  return Math.ceil((dueAt.getTime() - now.getTime()) / millisecondsPerDay);
}

/**
 * @description Converts a due-date offset into the concise reminder timing label shown in email and messages.
 * @param {number | undefined} daysRemaining - Signed day offset relative to the due date.
 * @returns {string} Human-readable timing label.
 */
export function createReminderTimingLabel(daysRemaining: number | undefined): string {
  if (daysRemaining === undefined) {
    return "Timing-based reminder";
  }
  if (daysRemaining < 0) {
    const daysOverdue = Math.abs(daysRemaining);
    return `Overdue by ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"}`;
  }
  if (daysRemaining === 0) {
    return "Due today";
  }
  if (daysRemaining === 1) {
    return "Due tomorrow";
  }
  return `Due in ${daysRemaining} days`;
}

/**
 * @description Builds a styled obligation reminder email and a plain-text fallback body.
 * @param {ReminderEmailTemplateInput} input - Obligation, contract, timing, and application context.
 * @returns {ReminderEmailTemplate} Email subject, text body, HTML body, and timing metadata.
 */
export function buildReminderEmail(input: ReminderEmailTemplateInput): ReminderEmailTemplate {
  const daysRemaining = calculateDaysRemaining(input.dueAt, input.now);
  const timingLabel = createReminderTimingLabel(daysRemaining);
  const safeAppName = escapeHtml(input.appName);
  const safeContractName = escapeHtml(input.contractName);
  const safeTitle = escapeHtml(input.obligationTitle);
  const safeDescription = escapeHtml(input.obligationDescription?.trim() || "No description provided.");
  const safeResponsibleParty = escapeHtml(input.responsibleParty?.trim() || "Responsible party unavailable");
  const safeCategory = escapeHtml(input.category?.trim() || "Uncategorized");
  const safeDueDate = input.dueAt ? escapeHtml(formatDate(input.dueAt)) : "No due date";
  const safeScheduledFor = escapeHtml(formatDate(input.scheduledFor));
  const subject = `[${input.appName}] ${timingLabel}: ${input.obligationTitle}`;
  const actionLink = input.contractUrl
    ? `<a href="${escapeHtml(input.contractUrl)}" style="display:inline-block;background:#00A878;color:#ffffff;text-decoration:none;font-weight:700;border-radius:6px;padding:12px 18px;">Open Contract</a>`
    : "";

  const bodyText = [
    `${timingLabel}: ${input.obligationTitle}`,
    "",
    `Contract: ${input.contractName}`,
    `Responsible party: ${input.responsibleParty?.trim() || "Responsible party unavailable"}`,
    `Category: ${input.category?.trim() || "Uncategorized"}`,
    `Due date: ${input.dueAt ? formatDate(input.dueAt) : "No due date"}`,
    `Reminder scheduled for: ${formatDate(input.scheduledFor)}`,
    "",
    input.obligationDescription?.trim() || "No description provided.",
    ...(input.contractUrl ? ["", `Open contract: ${input.contractUrl}`] : []),
  ].join("\n");

  const bodyHtml = `<!doctype html>
<html>
  <body style="margin:0;background:#F8FAFC;color:#0F172A;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F8FAFC;padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:94%;background:#FFFFFF;border:1px solid #DDE7F0;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #DDE7F0;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0;color:#64748B;text-transform:uppercase;">${safeAppName}</div>
                <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;color:#0F172A;">${escapeHtml(timingLabel)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#334155;">A contract obligation requires attention.</p>
                <div style="border-left:4px solid #00A878;background:#ECFDF7;padding:16px 18px;border-radius:6px;margin:18px 0 22px;">
                  <div style="font-size:18px;line-height:1.35;font-weight:700;color:#0F172A;">${safeTitle}</div>
                  <div style="font-size:14px;line-height:1.6;color:#475569;margin-top:8px;">${safeDescription}</div>
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 22px;">
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:12px;font-weight:700;text-transform:uppercase;">Contract</td>
                    <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:14px;text-align:right;">${safeContractName}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:12px;font-weight:700;text-transform:uppercase;">Responsible</td>
                    <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:14px;text-align:right;">${safeResponsibleParty}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:12px;font-weight:700;text-transform:uppercase;">Due Date</td>
                    <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:14px;text-align:right;">${safeDueDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:12px;font-weight:700;text-transform:uppercase;">Category</td>
                    <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:14px;text-align:right;">${safeCategory}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#64748B;font-size:12px;font-weight:700;text-transform:uppercase;">Reminder Date</td>
                    <td style="padding:10px 0;color:#0F172A;font-size:14px;text-align:right;">${safeScheduledFor}</td>
                  </tr>
                </table>
                ${actionLink}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject,
    bodyText,
    bodyHtml,
    ...(daysRemaining !== undefined ? { daysRemaining } : {}),
    timingLabel,
  };
}
