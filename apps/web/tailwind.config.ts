import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "#e2e8f0",
        surface: "#fafafa",
        ink: "#0f172a",
        muted: "#64748b",
        accent: "#0d9488",
      },
      boxShadow: {
        focus: "0 0 0 3px rgba(20, 184, 166, 0.24)",
        card: "0 1px 2px rgba(15, 23, 42, 0.04)",
        "card-hover": "0 10px 24px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
