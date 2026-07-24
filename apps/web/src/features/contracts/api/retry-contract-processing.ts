import { apiRequest } from "@/services/api-client.js";

export function retryContractProcessing(contractId: string) {
  return apiRequest(`/api/v1/contracts/${contractId}/retry`, {
    method: "POST",
  });
}
