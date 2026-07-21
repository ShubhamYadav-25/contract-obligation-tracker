export const queryKeys = {
  contracts: {
    all: ["contracts"] as const,
    detail: (id: string) => ["contracts", id] as const,
  },
  reviews: {
    all: ["reviews"] as const,
    detail: (id: string) => ["reviews", id] as const,
  },
  obligations: {
    all: ["obligations"] as const,
    detail: (id: string) => ["obligations", id] as const,
  },
  kpis: {
    latest: ["kpis", "latest"] as const,
  },
};
