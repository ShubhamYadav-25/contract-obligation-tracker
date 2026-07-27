/**
 * @file Defines reusable layout components for the web shell.
 */
import type { PropsWithChildren, ReactNode } from "react";

/**
 * @description Renders the page header component for the contract tracker UI.
 * @param {PropsWithChildren<{ readonly title: string; readonly description?: string; readonly actions?: ReactNode; }>} { actions, children, description, title, } - Input value for { actions, children, description, title, }.
 * @returns {JSX.Element} Result of the page header operation.
 */
export function PageHeader({
  actions,
  children,
  description,
  title,
}: PropsWithChildren<{
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}>) {
  return (
    <div className="mb-7 flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between lg:mb-8">
      <div>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
