import type { TextareaHTMLAttributes } from "react";

import { cx } from "@/utils/cx.js";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "min-h-28 rounded-md border border-border bg-white px-3 py-2 text-sm text-ink shadow-sm focus-visible:shadow-focus",
        className,
      )}
      {...props}
    />
  );
}
