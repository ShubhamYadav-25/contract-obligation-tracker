import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { ErrorBoundary } from "@/components/feedback/error-boundary.js";
import { AuthProvider } from "../features/auth/auth-provider.js";
import { queryClient } from "./query-client.js";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
}
