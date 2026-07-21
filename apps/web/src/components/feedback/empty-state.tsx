import type { PropsWithChildren } from "react";

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
