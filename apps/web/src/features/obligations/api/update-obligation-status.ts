/**
 * @file Defines frontend API client calls for a contract tracker feature.
 */
import type { ObligationStatus } from "@contract-obligation-tracker/shared";

import { apiRequest } from "@/services/api-client.js";

/**
 * @description Executes the update obligation status operation used by the application workflow.
 * @param {{ readonly obligationId: string; readonly toStatus: ObligationStatus; readonly expectedVersion: number; }} input - Input value for input.
 * @returns {unknown} Result of the update obligation status operation.
 */
export function updateObligationStatus(input: {
  readonly obligationId: string;
  readonly toStatus: ObligationStatus;
  readonly expectedVersion: number;
}) {
  return apiRequest(`/api/obligations/${input.obligationId}/status`, {
    method: "PATCH",
    body: {
      toStatus: input.toStatus,
      expectedVersion: input.expectedVersion,
    },
  });
}
