/**
 * @file Defines reusable atomic UI primitives for the web app.
 */
import type { SelectHTMLAttributes } from "react";

import { cx } from "@/utils/cx.js";

/**
 * @description Renders the select component for the contract tracker UI.
 * @param {SelectHTMLAttributes<HTMLSelectElement>} { className, ...props } - Input value for { class name, ...props }.
 * @returns {JSX.Element} Result of the select operation.
 */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "min-h-11 cursor-pointer rounded-lg border border-slate-300 bg-white px-3.5 text-[0.9375rem] text-slate-950 shadow-sm transition-colors hover:border-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20 disabled:cursor-not-allowed disabled:bg-slate-100",
        className,
      )}
      {...props}
    />
  );
}
