import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "#d8dde6",
        surface: "#f7f8fb",
        ink: "#172033",
        muted: "#657083",
        accent: "#0f766e",
      },
      boxShadow: {
        focus: "0 0 0 3px rgba(15, 118, 110, 0.22)",
      },
    },
  },
  plugins: [],
} satisfies Config;
