import { apiRequest } from "@/services/api-client.js";
import { obligationSummarySchema } from "./list-obligations.js";

export interface UpdateObligationInput {
  readonly obligationId: string;
  readonly expectedVersion: number;
  readonly title?: string;
  readonly description?: string;
  readonly dueAt?: string | null;
  readonly responsibleParty?: string | null;
  readonly counterparty?: string | null;
  readonly category?: string | null;
  readonly timingType?: string | null;
  readonly frequency?: string | null;
  readonly triggerEvent?: string | null;
  readonly offsetValue?: number | null;
  readonly offsetUnit?: string | null;
  readonly offsetDirection?: string | null;
  readonly reviewStatus?: string | null;
}

export function updateObligation({ obligationId, ...body }: UpdateObligationInput) {
  return apiRequest(`/api/obligations/${obligationId}`, {
    method: "PATCH",
    body,
    responseSchema: obligationSummarySchema,
  });
}
