import { z } from "zod";

import { apiRequest } from "../../../services/api-client.js";
import type { MessageSummary } from "../types/message.js";

const messageSummarySchema = z.object({
  id: z.string(),
  reminderId: z.string(),
  obligationId: z.string(),
  contractId: z.string(),
  contractDisplayName: z.string(),
  obligationTitle: z.string(),
  reminderStatus: z.string(),
  scheduledFor: z.string(),
  payload: z.unknown(),
  createdAt: z.string(),
});

const messageListSchema = z.array(messageSummarySchema);

export interface ListMessagesInput {
  readonly obligationId?: string;
  readonly reminderId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export function listMessages(input: ListMessagesInput = {}, signal?: AbortSignal) {
  const query = new URLSearchParams();
  if (input.obligationId) {
    query.set("obligationId", input.obligationId);
  }
  if (input.reminderId) {
    query.set("reminderId", input.reminderId);
  }
  if (input.limit !== undefined) {
    query.set("limit", String(input.limit));
  }
  if (input.offset !== undefined) {
    query.set("offset", String(input.offset));
  }

  const path = query.size > 0 ? `/api/messages?${query.toString()}` : "/api/messages";

  return apiRequest<readonly MessageSummary[]>(path, {
    signal,
    responseSchema: messageListSchema,
  });
}
