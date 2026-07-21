import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cx } from "../../utils/cx.js";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-teal-800",
  secondary: "border border-border bg-white text-ink hover:bg-surface",
  danger: "bg-red-700 text-white hover:bg-red-800",
  ghost: "text-ink hover:bg-surface",
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
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
