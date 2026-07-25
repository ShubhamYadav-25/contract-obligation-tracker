/**
 * @file Defines frontend API client calls for a contract tracker feature.
 */
import { apiRequest } from "@/services/api-client.js";
import { contractSummarySchema } from "./list-contracts.js";
import type { ContractDetail } from "../types/contracts.js";

/**
 * @description Executes the get contract operation used by the application workflow.
 * @param {string} contractId - Input value for contract id.
 * @param {AbortSignal} signal - Input value for signal.
 * @returns {unknown} Result of the get contract operation.
 */
export function getContract(contractId: string, signal?: AbortSignal) {
  return apiRequest<ContractDetail>(`/api/v1/contracts/${contractId}`, {
    signal,
    responseSchema: contractSummarySchema,
  });
}
