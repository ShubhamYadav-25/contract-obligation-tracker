import type { SelectHTMLAttributes } from "react";

import { cx } from "../../utils/cx.js";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-10 rounded-md border border-border bg-white px-3 text-sm text-ink shadow-sm focus-visible:shadow-focus",
        className,
      )}
      {...props}
    />
  );
}
