/**
 * @file Configures Tailwind content scanning and theme extension tokens.
 */
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    fontSize: {
      xs: ["0.8125rem", { lineHeight: "1.25rem" }],
      sm: ["0.9375rem", { lineHeight: "1.5rem" }],
      base: ["1rem", { lineHeight: "1.625rem" }],
      lg: ["1.125rem", { lineHeight: "1.75rem" }],
      xl: ["1.25rem", { lineHeight: "1.75rem" }],
      "2xl": ["1.5rem", { lineHeight: "2rem" }],
      "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
    },
    extend: {
      colors: {
        border: "#dbe3ee",
        surface: "#f6f8fb",
        ink: "#172033",
        muted: "#526176",
        accent: "#087f73",
      },
      boxShadow: {
        focus: "0 0 0 3px rgba(8, 127, 115, 0.28)",
        card: "0 1px 3px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.04)",
        "card-hover": "0 12px 28px rgba(15, 23, 42, 0.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
