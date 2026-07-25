/**
 * @file Defines reusable atomic UI primitives for the web app.
 */
import type { TextareaHTMLAttributes } from "react";

import { cx } from "@/utils/cx.js";

/**
 * @description Renders the textarea component for the contract tracker UI.
 * @param {TextareaHTMLAttributes<HTMLTextAreaElement>} { className, ...props } - Input value for { class name, ...props }.
 * @returns {JSX.Element} Result of the textarea operation.
 */
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
