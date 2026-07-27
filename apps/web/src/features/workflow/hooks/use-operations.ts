import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getContractActivity,
  getContractProfile,
  getProcessingHistory,
  getDashboardOverview,
  saveContractProfile,
} from "../api/operations.js";

export function useContractProfile(contractId: string) {
  return useQuery({
    queryKey: ["contracts", contractId, "profile"],
    queryFn: ({ signal }) => getContractProfile(contractId, signal),
    retry: false,
  });
}

export function useSaveContractProfile(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveContractProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contracts", contractId, "profile"] });
      void queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: ({ signal }) => getDashboardOverview(signal),
  });
}

export function useProcessingHistory(contractId: string) {
  return useQuery({
    queryKey: ["contracts", contractId, "processing-history"],
    queryFn: ({ signal }) => getProcessingHistory(contractId, signal),
  });
}

export function useContractActivity(contractId: string) {
  return useQuery({
    queryKey: ["contracts", contractId, "activity"],
    queryFn: ({ signal }) => getContractActivity(contractId, signal),
  });
}
