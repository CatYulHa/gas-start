# GasStart

[![CI](https://github.com/CatYulHa/gas-start/actions/workflows/ci.yml/badge.svg)](https://github.com/CatYulHa/gas-start/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**A Google Apps Script starter kit** — write the backend in TypeScript, push/deploy to
separate dev and prod projects with `clasp`, ship a React + Vite dashboard as a single
HTML file through HtmlService, and load data into the spreadsheet with Python (pandas + gspread).

[한국어 README](./README.md)

```
Python ETL ──write──▶  Google Sheets (as DB)  ◀──read──  Apps Script (TS)  ──HtmlService──▶  React dashboard
gasstart-sheets seed         `data` tab                  getDashboardData()  google.script.run    KPIs · chart · table
```

## Highlights

- **dev / prod with clasp** — `.clasp.dev.json` / `.clasp.prod.json` are swapped in by `scripts/clasp.mjs`; `npm run push:dev`, `npm run deploy:prod`.
- **TypeScript backend** — clasp 3 no longer transpiles TS, so Vite + `@gas-plugin/unplugin` bundle `dist/Code.js` (exports stripped, entry points kept, manifest copied).
- **Single-file React dashboard** — Vite + `vite-plugin-singlefile` → `dist/index.html`, served by `doGet()`. `npm run dev` runs on mock data without deploying.
- **Shared types** — `ServerApi` in `packages/shared` makes `google.script.run` calls type-safe end to end.
- **Python ETL with a cached OAuth token** — `gasstart-sheets` CLI/library; browser consent once, then `.secrets/token.json` is reused (the classic `token.pickle` flow).
- **CI** — typecheck, build assertions, pytest; optional prod deploy workflow.

## Quick start — one command

```bash
npm install
npm run setup
```

`npm run setup` logs you into Google (browser, token cached in `~/.clasprc.json`), checks that the
[Apps Script API toggle](https://script.google.com/home/usersettings) is on for the account (opens the page and waits if not), creates a
**new Spreadsheet with a bound Apps Script project**, builds, pushes, deploys the web app and
opens it. You land on a "👋 Hello, GasStart!" page (private to you by default — `webapp.access: MYSELF`, see [docs/deploy.md §7](./docs/deploy.md) to share); accept the one-time authorization prompt,
click **Load sample data**, and the KPI tiles, chart and table appear. From there, edit
`packages/dashboard/src/App.tsx` and `packages/gas/src/main.ts`.

Options: `--type standalone` (no sheet; set Script Property `SPREADSHEET_ID`), `--title`, `--env staging`, `--no-open`, `--dry-run`.
Have an existing script? Put its `scriptId` in `packages/gas/.clasp.dev.json` first and `setup` skips creation.

Day to day: `npm run dev` (mock data, `?empty` previews the welcome screen), `npm run push:dev`, `npm run deploy:dev`, `npm run setup:prod`.

## Environments

clasp only reads `.clasp.json`. GasStart keeps one file per environment in `packages/gas/`
and copies the clasp-relevant fields into `.clasp.json` right before each command.

| Command | Does |
|---|---|
| `npm run setup` / `setup:prod` | login → create → build → push → deploy → open, in one go |
| `npm run create:<env>` | `clasp create-script --type sheets` (default), persists scriptId to `.clasp.<env>.json` |
| `npm run push:<env>` | `npm run build` then `clasp push -f` |
| `npm run deploy:<env>` | `create-deployment` (id saved automatically), then `update-deployment` on later runs (stable URL) |
| `npm run web:<env>` / `open:<env>` / `sheet:<env>` | open web app / editor / bound spreadsheet |
| `npm run clasp -- <env> <any clasp command>` | pass-through |

## Python

```bash
cd python && pip install -e ".[dev]"
gasstart-sheets auth                        # first run: browser consent -> .secrets/token.json
gasstart-sheets seed <SHEET_ID>             # sample data into the `data` tab
gasstart-sheets read <SHEET_ID> data -o out.csv
```

Credentials: create an OAuth client of type **Desktop app** in Google Cloud Console (with the
Sheets and Drive APIs enabled) and save it as `.secrets/credentials.json`. Set
`GASSTART_SERVICE_ACCOUNT=/path/sa.json` to use a service account instead (CI/bots).

See the Korean README for the full walkthrough, security notes and troubleshooting table.

## Working with AI coding tools

Open the repo in Codex, Cursor, Windsurf, Devin, Copilot, Claude Code, … — they read `AGENTS.md` at the root
(layout, the three-edit rule for server functions, verification commands). Prompt recipes: [docs/ai-guide.md](./docs/ai-guide.md).

## More docs

- [docs/deploy.md](./docs/deploy.md) — what `setup` creates where, `/dev` vs `/exec`, dev→prod, cleanup, the "unverified app" warning
- [docs/apps-script-guide.md](./docs/apps-script-guide.md) — Apps Script as a serverless platform for company dashboards: `executeAs × access`, restricting to your Workspace domain (`DOMAIN`), per-user data, admin policies, quotas (Korean)
- [python/README.md](./python/README.md) — Python ETL package

## Troubleshooting

- **"Google hasn't verified this app"** on first visit — expected for unverified OAuth apps. Only the deployer sees it, once: *Advanced → Go to … (unsafe) → Allow*. Visitors never see a consent screen (`executeAs: USER_DEPLOYING`). Details in [docs/deploy.md §6](./docs/deploy.md).

- **Windows PowerShell: `npm.ps1 cannot be loaded` (PSSecurityException)** — execution policy. Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once (no admin needed) or use `npm.cmd run setup`.
- See the Korean README for the full table.

## License

MIT. GasStart is an independent project, not affiliated with or endorsed by Google LLC. Google Apps Script and Google Sheets are trademarks of Google LLC. Security defaults and reporting: [SECURITY.md](./SECURITY.md).
