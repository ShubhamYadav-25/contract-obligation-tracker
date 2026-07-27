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
        "min-h-32 rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-[0.9375rem] leading-6 text-slate-950 shadow-sm placeholder:text-slate-500 hover:border-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20",
        className,
      )}
      {...props}
    />
  );
}
