# GasStart — instructions for AI coding agents

This file is the single source of truth for every AI tool (Codex, Cursor, Windsurf, Devin, Copilot,
Claude Code, Jules, …). Tool-specific files in this repo only point here — edit this one.

Google Apps Script starter: TypeScript backend + React/Vite dashboard served as a single HTML
file through HtmlService, deployed with clasp (dev/prod), plus an optional Python (pandas +
gspread) ETL package. The spreadsheet is the database; the dashboard reads it via
`google.script.run`.

## Layout

| Path | Role |
|---|---|
| `packages/shared/src/index.ts` | Types shared by server and client: `Row`, `DataPoint`, `DashboardData`, **`ServerApi`** (every server function the client may call). No runtime deps. |
| `packages/gas/src/main.ts` | Apps Script entry points (`doGet`, `getDashboardData`, `seedSampleData`, `ping`, `setup`, `showConfig`). Exported functions become globals in `dist/Code.js`. |
| `packages/gas/src/sheets.ts` | `readTable` / `writeTable` — header row ↔ `Row[]`. |
| `packages/gas/src/config.ts` | `getSpreadsheet()` — bound sheet, or Script Property `SPREADSHEET_ID` for standalone scripts. |
| `packages/gas/appsscript.json` | Manifest: V8, `oauthScopes` (least privilege), `webapp` access. |
| `packages/gas/vite.config.ts` | Bundles to `dist/Code.js`; **`globals` list protects entry points from tree-shaking**. |
| `packages/dashboard/src/lib/gas.ts` | `runGas(fn, ...args)` typed Promise wrapper; falls back to `mock/data.json` when not inside Apps Script. |
| `packages/dashboard/src/lib/transform.ts` | Rows → typed points, pivot, KPIs. |
| `packages/dashboard/src/App.tsx`, `components/` | UI: header, KPI tiles, Recharts line chart, table, `Welcome` (empty state). |
| `packages/dashboard/src/styles.css` | Design tokens (`--series-1..8`, surfaces, text) with dark mode. |
| `scripts/setup.mjs`, `scripts/clasp.mjs`, `scripts/lib.mjs` | One-shot bootstrap and env-aware clasp wrapper. |
| `python/` | `gasstart-sheets`: `get_client()` (cached OAuth token), `read_df` / `write_df`, CLI. |
| `docs/` | `deploy.md` (what gets created where, dev→prod, cleanup), `apps-script-guide.md` (executeAs × access, domain restriction, quotas), `ai-guide.md` (prompt recipes). |

## Rules

1. **Adding a server function** = three edits: `export function` in `packages/gas/src/main.ts`, signature in `ServerApi` (`packages/shared`), name in `globals` (`packages/gas/vite.config.ts`). Call it from the client with `runGas("name", ...)`. Missing any one breaks at runtime, not compile time.
2. Values crossing `google.script.run` must be JSON-serialisable (no `Date`, no `undefined` inside arrays). Use ISO strings.
3. The dashboard must work without Apps Script (`npm run dev`, mock data). Keep `isGas` fallbacks intact; update `mock/data.json` when the schema changes.
4. Keep `packages/shared` free of runtime dependencies — it is bundled into both sides.
5. No external `<script src>` / `<link href>` in the dashboard — everything is inlined. Add libraries via npm.
6. Chart colours come from the `--series-N` tokens, assigned in first-seen category order and never re-cycled when filtering. Text uses text tokens, not series colours. Legend for ≥2 series.
7. Every exported server function is a public endpoint for anyone who can open the web app, and runs as the deployer (`USER_DEPLOYING`). Functions that **write** must call `assertDeployer()` (see `seedSampleData`) or otherwise authorize; validate arguments. `webapp.access` defaults to `MYSELF` — widen only deliberately (docs/deploy.md §7).
8. Least privilege in `appsscript.json` `oauthScopes`: `spreadsheets.currentonly` for bound sheets; switch to `spreadsheets` only for standalone/`openById`; add `script.external_request` for `UrlFetchApp`.
9. Never commit `packages/gas/.clasp*.json` (except `.clasp.example.json`) or `.secrets/`.
10. Sample data generators (`packages/gas/src/sample.ts`, `python/.../sample.py`, `dashboard/src/mock/data.json`) share one schema — change all three together.

## Verify before finishing

```bash
npm run typecheck && npm run build     # dist/Code.js (no export/import), dist/index.html (self-contained), appsscript.json
cd python && pytest && ruff check .    # only if python/ changed
```

Then `npm run push:dev` and check the `/dev` URL; `npm run deploy:dev` publishes to `/exec`.
