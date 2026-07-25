/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { listObligations } from "../api/list-obligations.js";
import type {
  ObligationDueDateRangeFilter,
  ObligationReminderFilter,
  ObligationStatus,
} from "../types/obligation.js";

/**
 * @description Provides the use obligations hook for React data access or state coordination.
 * @param {string} contractId - Input value for contract id.
 * @param {{ readonly search?: string; readonly status?: ObligationStatus; readonly reminderStatus?: ObligationReminderFilter; readonly dueDateRange?: ObligationDueDateRangeFilter; readonly limit?: number; readonly offset?: number; }} input - Input value for input.
 * @returns {unknown} Result of the use obligations operation.
 */
export function useObligations(
  contractId?: string,
  input: {
    readonly search?: string;
    readonly status?: ObligationStatus;
    readonly reminderStatus?: ObligationReminderFilter;
    readonly dueDateRange?: ObligationDueDateRangeFilter;
    readonly limit?: number;
    readonly offset?: number;
  } = {},
) {
  const queryInput = {
    ...(contractId ? { contractId } : {}),
    ...(input.search?.trim() ? { search: input.search.trim() } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.reminderStatus ? { reminderStatus: input.reminderStatus } : {}),
    ...(input.dueDateRange ? { dueDateRange: input.dueDateRange } : {}),
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
  };

  return useQuery({
    queryKey: queryKeys.obligations.list(queryInput),
    queryFn: ({ signal }) => listObligations(queryInput, signal),
  });
}
