import type { PropsWithChildren } from "react";

import { cx } from "@/utils/cx.js";

export function Table({
  children,
  className,
}: PropsWithChildren<{
  readonly className?: string;
}>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className={cx("min-w-full divide-y divide-border text-left text-sm", className)}>
        {children}
      </table>
    </div>
  );
}
