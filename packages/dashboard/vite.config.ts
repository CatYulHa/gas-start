import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Apps Script's HtmlService cannot load <script src> / <link href> from the
 * project, so the whole app (JS + CSS) is inlined into one index.html.
 * The output lands in packages/gas/dist next to Code.js and appsscript.json;
 * `npm run build` at the repo root runs this build first, then the GAS build.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "../gas/dist",
    emptyOutDir: false,
    target: "es2020",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    reportCompressedSize: false,
  },
});
