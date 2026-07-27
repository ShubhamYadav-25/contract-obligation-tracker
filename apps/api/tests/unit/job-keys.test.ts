/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it } from "vitest";

import {
  createContractProcessingJobKey,
  createReminderDeliveryJobKey,
} from "../../src/jobs/job-keys.js";
import { createReminderOccurrenceKey } from "../../src/modules/reminders/reminder-occurrence-key.js";

describe("job idempotency keys", () => {
  it("creates deterministic contract processing keys", () => {
    expect(
      createContractProcessingJobKey({
        documentId: "document-1",
        processingRunId: "run-1",
      }),
    ).toBe(
      "contract-processing:document-1:run-1",
    );
  });

  it("creates deterministic reminder delivery keys", () => {
    expect(createReminderDeliveryJobKey("reminder-1")).toBe("reminder:reminder-1:delivery");
  });

  it("keeps deterministic reminder occurrence keys", () => {
    expect(
      createReminderOccurrenceKey({
        obligationId: "obligation-1",
        scheduledFor: new Date("2026-07-20T10:00:00.000Z"),
      }),
    ).toBe("obligation:obligation-1:scheduled:2026-07-20T10:00:00.000Z");
  });
});
