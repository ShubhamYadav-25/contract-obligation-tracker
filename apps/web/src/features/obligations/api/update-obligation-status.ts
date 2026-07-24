import type { ObligationStatus } from "@contract-obligation-tracker/shared";

import { apiRequest } from "@/services/api-client.js";

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
