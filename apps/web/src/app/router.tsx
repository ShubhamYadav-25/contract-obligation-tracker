/**
 * @file Defines web app routing, providers, paths, or app composition.
 */
import { Suspense, lazy, type ReactElement } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import { LoadingState } from "@/components/feedback/loading-state.js";
import { AppShell } from "@/components/layout/app-shell.js";
import { ContractsPage } from "../features/workflow/pages/contracts-page.js";
import { DashboardPage } from "../features/workflow/pages/dashboard-page.js";
import { ObligationsPage } from "../features/workflow/pages/obligations-page.js";
import { MessagesPage } from "../features/messages/index.js";
import { ObligationDetailPage } from "../features/obligations/pages/obligation-detail-page.js";
import { routePaths } from "./route-paths.js";

const ContractWorkspacePage = lazy(async () => {
  const module = await import("../features/workflow/pages.js");
  return { default: module.ContractWorkspacePage };
});

function lazyRoute(element: ReactElement): ReactElement {
  return <Suspense fallback={<LoadingState label="Loading workspace" />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: routePaths.home, element: <Navigate to={routePaths.dashboard} replace /> },
      { path: routePaths.dashboard, element: <DashboardPage /> },
      { path: routePaths.contracts, element: <ContractsPage /> },
      { path: "/contracts/:contractId", element: lazyRoute(<ContractWorkspacePage />) },
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
