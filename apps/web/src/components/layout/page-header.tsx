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
    <div className="mb-7 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold leading-[38px] tracking-normal text-slate-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
