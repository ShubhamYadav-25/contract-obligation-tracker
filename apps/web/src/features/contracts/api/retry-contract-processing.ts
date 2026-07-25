/**
 * @file Defines frontend API client calls for a contract tracker feature.
 */
import { apiRequest } from "@/services/api-client.js";

/**
 * @description Executes the retry contract processing operation used by the application workflow.
 * @param {string} contractId - Input value for contract id.
 * @returns {unknown} Result of the retry contract processing operation.
 */
export function retryContractProcessing(contractId: string) {
  return apiRequest(`/api/v1/contracts/${contractId}/retry`, {
    method: "POST",
  });
}
