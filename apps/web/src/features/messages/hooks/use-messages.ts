import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import { listMessages, type ListMessagesInput } from "../api/list-messages.js";

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
