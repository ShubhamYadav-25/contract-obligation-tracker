/**
 * @file Defines web app routing, providers, paths, or app composition.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { ErrorBoundary } from "@/components/feedback/error-boundary.js";
import { AuthProvider } from "../features/auth/auth-provider.js";
import { queryClient } from "./query-client.js";

/**
 * @description Renders the app providers component for the contract tracker UI.
 * @param {PropsWithChildren} { children } - Input value for { children }.
 * @returns {JSX.Element} Result of the app providers operation.
 */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
}
