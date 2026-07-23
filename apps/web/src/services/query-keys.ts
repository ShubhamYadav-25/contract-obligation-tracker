export const queryKeys = {
  contracts: {
    all: ["contracts"] as const,
    list: (input: { readonly search?: string; readonly limit: number; readonly offset: number }) =>
      ["contracts", "list", input] as const,
    detail: (id: string) => ["contracts", id] as const,
    processingStatus: (id: string) => ["contracts", id, "processing-status"] as const,
    textPages: (id: string) => ["contracts", id, "text-pages"] as const,
  },
  reviews: {
    all: ["reviews"] as const,
    detail: (id: string) => ["reviews", id] as const,
  },
  obligations: {
    all: ["obligations"] as const,
    list: (input: {
      readonly contractId?: string;
      readonly search?: string;
      readonly status?: string;
      readonly reminderStatus?: string;
      readonly dueDateRange?: string;
      readonly limit: number;
      readonly offset: number;
    }) => ["obligations", "list", input] as const,
    byContract: (contractId: string) => ["obligations", "contract", contractId] as const,
    detail: (id: string) => ["obligations", id] as const,
  },
  messages: {
    all: ["messages"] as const,
    list: (input: {
      readonly obligationId?: string;
      readonly reminderId?: string;
      readonly limit: number;
      readonly offset: number;
    }) => ["messages", "list", input] as const,
  },
  kpis: {
    latest: ["kpis", "latest"] as const,
  },
};
