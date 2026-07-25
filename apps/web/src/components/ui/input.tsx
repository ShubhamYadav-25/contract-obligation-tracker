/**
 * @file Defines reusable atomic UI primitives for the web app.
 */
import type { InputHTMLAttributes } from "react";

import { cx } from "@/utils/cx.js";

/**
 * @description Renders the input component for the contract tracker UI.
 * @param {InputHTMLAttributes<HTMLInputElement>} { className, ...props } - Input value for { class name, ...props }.
 * @returns {JSX.Element} Result of the input operation.
 */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-ink shadow-sm transition placeholder:text-slate-400 hover:border-slate-400 focus:border-teal-500 focus:outline-none focus-visible:shadow-focus",
        className,
      )}
      {...props}
    />
  );
}
