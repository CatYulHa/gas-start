import gasPlugin from "@gas-plugin/unplugin/vite";
import { defineConfig } from "vite";

/**
 * Bundles src/main.ts into a single dist/Code.js that Apps Script can run:
 * - `export` keywords are stripped, top-level functions stay global
 * - functions listed in `globals` survive tree-shaking (entry points GAS calls by name)
 * - appsscript.json is copied next to Code.js
 *
 * The dashboard build writes dist/index.html first (see packages/dashboard/vite.config.ts),
 * so emptyOutDir must stay false here.
 */
export default defineConfig({
  plugins: [
    gasPlugin({
      manifest: "appsscript.json",
      globals: ["doGet", "getDashboardData", "seedSampleData", "ping", "setup", "showConfig"],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    minify: false,
    target: "es2020",
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: () => "Code.js",
    },
  },
});
