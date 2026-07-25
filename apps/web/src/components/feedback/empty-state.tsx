/**
 * @file Defines reusable feedback components for loading, empty, retry, or error states.
 */
import type { PropsWithChildren } from "react";

/**
 * @description Renders the empty state component for the contract tracker UI.
 * @param {PropsWithChildren<{ readonly title: string; }>} { children, title, } - Input value for { children, title, }.
 * @returns {JSX.Element} Result of the empty state operation.
 */
export function EmptyState({
  children,
  title,
}: PropsWithChildren<{
  readonly title: string;
}>) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      {children ? <div className="mt-2 text-sm text-muted">{children}</div> : null}
    </div>
  );
}
