export const routePaths = {
  home: "/",
  contracts: "/contracts",
  contractUpload: "/contracts/upload",
  contractDetail: (contractId: string) => `/contracts/${contractId}`,
  reviews: "/reviews",
  reviewDetail: (candidateId: string) => `/reviews/${candidateId}`,
  obligations: "/obligations",
  obligationDetail: (obligationId: string) => `/obligations/${obligationId}`,
  kpis: "/kpis",
} as const;
