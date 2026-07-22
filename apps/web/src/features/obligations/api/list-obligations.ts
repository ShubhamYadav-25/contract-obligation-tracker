import { z } from "zod";

import { apiRequest } from "../../../services/api-client.js";
import type { ObligationSummary } from "../types/obligation.js";

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

export function listObligations(
  input: {
    readonly contractId?: string;
    readonly search?: string;
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
  if (input.limit !== undefined) {
    query.set("limit", String(input.limit));
  }
  if (input.offset !== undefined) {
    query.set("offset", String(input.offset));
  }
  const path = query.size > 0 ? `/api/obligations?${query.toString()}` : "/api/obligations";

  return apiRequest<readonly ObligationSummary[]>(path, {
    signal,
    responseSchema: z.array(obligationSummarySchema),
  });
}
