import { z } from "zod";

import { apiRequest } from "../../../services/api-client.js";
import type {
  ObligationDueDateRangeFilter,
  ObligationListResult,
  ObligationReminderFilter,
  ObligationStatus,
} from "../types/obligation.js";

const obligationStatusSchema = z.enum(["UPCOMING", "DUE", "MET", "MISSED"]);
const sourceBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
const sourceAnchorSchema = z.object({
  pageNumber: z.number(),
  quotedText: z.string().optional(),
  boxes: z.array(sourceBoxSchema),
});

export const obligationSummarySchema = z.object({
  id: z.string(),
  contractId: z.string(),
  contractDisplayName: z.string().nullable().optional(),
  title: z.string(),
  description: z.string().optional(),
  status: obligationStatusSchema,
  dueAt: z.string().optional(),
  reminderStatus: z.string().nullable().optional(),
  nextReminderAt: z.string().nullable().optional(),
  sourceAnchors: z.array(sourceAnchorSchema).default([]),
  version: z.number(),
});

const obligationStatusCountsSchema = z.object({
  UPCOMING: z.number(),
  DUE: z.number(),
  MET: z.number(),
  MISSED: z.number(),
});

const obligationListSchema = z.object({
  items: z.array(obligationSummarySchema),
  total: z.number(),
  statusCounts: obligationStatusCountsSchema,
});

export function listObligations(
  input: {
    readonly contractId?: string;
    readonly search?: string;
    readonly status?: ObligationStatus;
    readonly reminderStatus?: ObligationReminderFilter;
    readonly dueDateRange?: ObligationDueDateRangeFilter;
    readonly limit?: number;
    readonly offset?: number;
  } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();
  if (input.contractId) {
    query.set("contractId", input.contractId);
  }
  if (input.search?.trim()) {
    query.set("search", input.search.trim());
  }
  if (input.status) {
    query.set("status", input.status);
  }
  if (input.reminderStatus) {
    query.set("reminderStatus", input.reminderStatus);
  }
  if (input.dueDateRange) {
    query.set("dueDateRange", input.dueDateRange);
  }
  if (input.limit !== undefined) {
    query.set("limit", String(input.limit));
  }
  if (input.offset !== undefined) {
    query.set("offset", String(input.offset));
  }
  const path = query.size > 0 ? `/api/obligations?${query.toString()}` : "/api/obligations";

  return apiRequest<ObligationListResult>(path, {
    signal,
    responseSchema: obligationListSchema,
  });
}
