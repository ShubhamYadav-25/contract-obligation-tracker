/**
 * @file Defines frontend API client calls for a contract tracker feature.
 */
import { apiRequest } from "@/services/api-client.js";
import { obligationSummarySchema } from "./list-obligations.js";

export interface UpdateObligationInput {
  readonly obligationId: string;
  readonly expectedVersion: number;
  readonly title?: string;
  readonly description?: string;
  readonly dueAt?: string | Date | null;
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

/**
 * @description Executes the update obligation operation used by the application workflow.
 * @param {UpdateObligationInput} { obligationId, ...body } - Input value for { obligation id, ...body }.
 * @returns {unknown} Result of the update obligation operation.
 */
export function updateObligation({ obligationId, ...body }: UpdateObligationInput) {
  return apiRequest(`/api/obligations/${obligationId}`, {
    method: "PATCH",
    body,
    responseSchema: obligationSummarySchema,
  });
}
