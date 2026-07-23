export const routePaths = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  contracts: "/contracts",
  contractUpload: "/contracts/upload",
  contractDetail: (contractId: string) => `/contracts/${contractId}`,
  messages: "/messages",
  reviews: "/reviews",
  reviewDetail: (candidateId: string) => `/reviews/${candidateId}`,
  obligations: "/obligations",
  obligationDetail: (obligationId: string) => `/obligations/${obligationId}`,
  kpis: "/kpis",
} as const;
