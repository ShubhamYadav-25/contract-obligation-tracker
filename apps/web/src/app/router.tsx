import { Navigate, createBrowserRouter } from "react-router-dom";

import { AppShell } from "../components/layout/app-shell.js";
import {
  ContractWorkspacePage,
  ContractsPage,
  DashboardPage,
  ObligationsPage,
} from "../features/workflow/pages.js";
import { MessagesPage } from "../features/messages/index.js";
import { ObligationDetailPage } from "../features/obligations/pages/obligation-detail-page.js";
import { routePaths } from "./route-paths.js";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: routePaths.home, element: <Navigate to={routePaths.dashboard} replace /> },
      { path: routePaths.dashboard, element: <DashboardPage /> },
      { path: routePaths.contracts, element: <ContractsPage /> },
      { path: "/contracts/:contractId", element: <ContractWorkspacePage /> },
      { path: routePaths.obligations, element: <ObligationsPage /> },
      { path: "/obligations/:obligationId", element: <ObligationDetailPage /> },
      { path: routePaths.messages, element: <MessagesPage /> },
      { path: routePaths.contractUpload, element: <Navigate to={routePaths.contracts} replace /> },
      { path: routePaths.reviews, element: <Navigate to={routePaths.dashboard} replace /> },
      { path: "/reviews/:candidateId", element: <Navigate to={routePaths.dashboard} replace /> },
      { path: routePaths.kpis, element: <Navigate to={routePaths.dashboard} replace /> },
    ],
  },
]);
