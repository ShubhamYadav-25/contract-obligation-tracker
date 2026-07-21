import type { PropsWithChildren, ReactNode } from "react";

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
    <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
