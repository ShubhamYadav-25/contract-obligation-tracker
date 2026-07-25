/**
 * @file Defines React Query hooks for a contract tracker feature.
 */
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { listMessages, type ListMessagesInput } from "../api/list-messages.js";

/**
 * @description Provides the use messages hook for React data access or state coordination.
 * @param {ListMessagesInput} input - Input value for input.
 * @returns {unknown} Result of the use messages operation.
 */
export function useMessages(input: ListMessagesInput = {}) {
  const queryInput = {
    ...(input.obligationId ? { obligationId: input.obligationId } : {}),
    ...(input.reminderId ? { reminderId: input.reminderId } : {}),
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
  };

  return useQuery({
    queryKey: queryKeys.messages.list(queryInput),
    queryFn: ({ signal }) => listMessages(queryInput, signal),
  });
}
