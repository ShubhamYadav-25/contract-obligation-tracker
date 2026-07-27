/**
 * @file Defines reusable atomic UI primitives for the web app.
 */
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cx } from "@/utils/cx.js";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-teal-800 bg-teal-700 text-white shadow-sm hover:bg-teal-800 hover:shadow-md active:bg-teal-900",
  secondary:
    "border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100",
  danger:
    "border border-rose-800 bg-rose-700 text-white shadow-sm hover:bg-rose-800 active:bg-rose-900",
  ghost:
    "text-slate-700 hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-[0.9375rem]",
  lg: "min-h-12 px-5 text-base",
};

/**
 * @description Renders the button component for the contract tracker UI.
 * @param {PropsWithChildren<ButtonProps>} { children, className, variant = "primary", ...props } - Input value for { children, class name, variant = "primary", ...props }.
 * @returns {JSX.Element} Result of the button operation.
 */
export function Button({
  children,
  className,
  size = "md",
  variant = "primary",
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-bold leading-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
