import { apiRequest } from "@/services/api-client.js";
import { contractSummarySchema } from "./list-contracts.js";
import type { ContractDetail } from "../types/contracts.js";

export function getContract(contractId: string, signal?: AbortSignal) {
  return apiRequest<ContractDetail>(`/api/v1/contracts/${contractId}`, {
    signal,
    responseSchema: contractSummarySchema,
  });
}
