/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
import { z } from "zod";

export const processContractJobPayloadSchema = z.object({
  organizationId: z.uuid(),
  contractId: z.uuid(),
  documentId: z.uuid(),
  processingRunId: z.uuid(),
});

export type ProcessContractJobPayload = z.infer<typeof processContractJobPayloadSchema>;
