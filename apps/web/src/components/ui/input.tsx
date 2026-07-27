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
        "min-h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-[0.9375rem] text-slate-950 shadow-sm transition-colors placeholder:text-slate-500 hover:border-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
        className,
      )}
      {...props}
    />
  );
}
