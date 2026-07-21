import type { InputHTMLAttributes } from "react";

import { cx } from "../../utils/cx.js";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "h-10 rounded-md border border-border bg-white px-3 text-sm text-ink shadow-sm focus-visible:shadow-focus",
        className,
      )}
      {...props}
    />
  );
}
