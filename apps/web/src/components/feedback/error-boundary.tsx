/**
 * @file Defines reusable feedback components for loading, empty, retry, or error states.
 */
import type { ErrorInfo, PropsWithChildren } from "react";
import { Component } from "react";

import { InlineError } from "./inline-error.js";

interface ErrorBoundaryState {
  readonly error?: Error;
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {};

  /**
   * @description Executes the get derived state from error operation used by the application workflow.
   * @param {Error} error - Input value for error.
   * @returns {ErrorBoundaryState} Result of the get derived state from error operation.
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  /**
   * @description Implements the component did catch method for this service or adapter.
   * @param {Error} _error - Input value for error.
   * @param {ErrorInfo} _errorInfo - Input value for error info.
   * @returns {void} Result of the component did catch operation.
   */
  override componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Hook for future client-side logging.
  }

  /**
   * @description Implements the render method for this service or adapter.
   * @returns {unknown} Result of the render operation.
   */
  override render() {
    if (this.state.error) {
      return <InlineError error={this.state.error} />;
    }
    return this.props.children;
  }
}
