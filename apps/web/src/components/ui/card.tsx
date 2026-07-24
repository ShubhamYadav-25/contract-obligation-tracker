import type { PropsWithChildren } from "react";

import { cx } from "@/utils/cx.js";

export function Card({
  children,
  className,
}: PropsWithChildren<{
  readonly className?: string;
}>) {
  return (
    <section className={cx("rounded-lg border border-border bg-white p-5", className)}>
      {children}
    </section>
  );
}
