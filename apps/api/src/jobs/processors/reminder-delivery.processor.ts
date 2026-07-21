import type { NotificationProvider } from "../../modules/notifications/notifications.types.js";
import type { BackgroundJob } from "../job.types.js";
import { PermanentJobError } from "../retry-policy.js";

export interface ReminderDeliveryPayload {
  readonly reminderId: string;
  readonly occurrenceKey: string;
}

function parsePayload(payload: unknown): ReminderDeliveryPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "reminderId" in payload &&
    "occurrenceKey" in payload &&
    typeof payload.reminderId === "string" &&
    typeof payload.occurrenceKey === "string"
  ) {
    return {
      reminderId: payload.reminderId,
      occurrenceKey: payload.occurrenceKey,
    };
  }

  throw new PermanentJobError("Invalid reminder delivery job payload");
}

export class ReminderDeliveryProcessor {
  constructor(private readonly notificationProvider?: NotificationProvider) {}

  async process(job: BackgroundJob): Promise<void> {
    const payload = parsePayload(job.payload);
    void payload;
    void this.notificationProvider;
    throw new Error("Reminder delivery workflow is not implemented yet");
  }
}
