import type { ErrorInfo, PropsWithChildren } from "react";
import { Component } from "react";

import { InlineError } from "./inline-error.js";

interface ErrorBoundaryState {
  readonly error?: Error;
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Hook for future client-side logging.
  }

  override render() {
    if (this.state.error) {
      return <InlineError error={this.state.error} />;
    }
    return this.props.children;
  }
}
