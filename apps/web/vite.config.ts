/**
 * @file Configures Vite, aliases, and browser test settings for the web app.
 */
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(dirname, "../..");

export default defineConfig({
  envDir: workspaceRoot,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
      "@contract-obligation-tracker/shared": path.resolve(
        workspaceRoot,
        "packages/shared/src/index.ts",
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("pdfjs-dist/build/pdf.worker")) return "vendor-pdf-worker";
          if (id.includes("pdfjs-dist/build/pdf")) return "vendor-pdf-core";
          if (id.includes("pdfjs-dist/web/pdf_viewer")) return "vendor-pdf-viewer";
          if (id.includes("pdfjs-dist")) return "vendor-pdf";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          if (id.includes("react-router")) {
            return "vendor-router";
          }
          if (id.includes("react-hook-form") || id.includes("@hookform/resolvers")) {
            return "vendor-forms";
          }
          if (id.includes("zod")) return "vendor-validation";
          if (id.includes("react")) return "vendor-react";

          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
