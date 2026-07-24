import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cx } from "@/utils/cx.js";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-card hover:bg-teal-700",
  secondary: "border border-slate-300 bg-white text-slate-700 shadow-card hover:bg-slate-50",
  danger: "bg-rose-700 text-white shadow-card hover:bg-rose-800",
  ghost: "text-slate-700 hover:bg-slate-100",
};

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition duration-150 ease-out focus-visible:shadow-focus active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
