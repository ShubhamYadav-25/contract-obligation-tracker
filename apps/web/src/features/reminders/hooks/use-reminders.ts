import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/services/query-keys.js";
import {
  createReminder,
  listReminders,
  rescheduleReminder,
  transitionReminder,
} from "../api/reminders.js";

export function useReminders(obligationId: string) {
  return useQuery({
    queryKey: queryKeys.reminders.byObligation(obligationId),
    queryFn: ({ signal }) => listReminders(obligationId, signal),
    enabled: Boolean(obligationId),
  });
}

export function useReminderMutations(obligationId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.reminders.byObligation(obligationId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.obligations.all });
  };
  return {
    create: useMutation({ mutationFn: createReminder, onSuccess: refresh }),
    reschedule: useMutation({ mutationFn: rescheduleReminder, onSuccess: refresh }),
    transition: useMutation({ mutationFn: transitionReminder, onSuccess: refresh }),
  };
}
