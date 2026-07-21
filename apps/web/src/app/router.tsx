import { Navigate, createBrowserRouter } from "react-router-dom";

import { AppShell } from "../components/layout/app-shell.js";
import { ContractDetailPage, ContractListPage } from "../features/contracts/index.js";
import { ContractUploadPage } from "../features/contract-upload/index.js";
import { ReviewDetailPage, ReviewQueuePage } from "../features/extraction-review/index.js";
import { KpiDashboardPage } from "../features/kpi-dashboard/index.js";
import { ObligationDetailPage, ObligationListPage } from "../features/obligations/index.js";
import { routePaths } from "./route-paths.js";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: routePaths.home, element: <Navigate to={routePaths.contracts} replace /> },
      { path: routePaths.contracts, element: <ContractListPage /> },
      { path: routePaths.contractUpload, element: <ContractUploadPage /> },
      { path: "/contracts/:contractId", element: <ContractDetailPage /> },
      { path: routePaths.reviews, element: <ReviewQueuePage /> },
      { path: "/reviews/:candidateId", element: <ReviewDetailPage /> },
      { path: routePaths.obligations, element: <ObligationListPage /> },
      { path: "/obligations/:obligationId", element: <ObligationDetailPage /> },
      { path: routePaths.kpis, element: <KpiDashboardPage /> },
    ],
  },
]);
