# Security

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's private
vulnerability reporting ("Security" tab → "Report a vulnerability") on this repository.
You should get an acknowledgement within a few days.

## What this project does and does not handle

GasStart is a starter template. Nothing in this repository talks to a server we operate,
and the repository ships **no credentials of any kind**:

- `clasp login` stores *your* Google token in `~/.clasprc.json` (owned by clasp). The setup
  script only reads it to check whether the Apps Script API is enabled; it never writes it.
- The Python package requires you to create **your own** OAuth client in Google Cloud Console;
  its files live in `.secrets/`, which is git-ignored.
- `packages/gas/.clasp.*.json` hold your script/deployment IDs and are git-ignored
  (only `.clasp.example.json` is tracked).

## Defaults chosen for safety

| Setting | Default | Why | To change |
|---|---|---|---|
| `webapp.access` | `MYSELF` | Only the deployer can open the web app. | `DOMAIN` (Workspace) or `ANYONE` in `packages/gas/appsscript.json`, then push + deploy. See `docs/deploy.md` §7. |
| `webapp.executeAs` | `USER_DEPLOYING` | Visitors never see an OAuth prompt; the script runs with the deployer's access. | Keep. If you switch to `USER_ACCESSING`, every visitor must authorize. |
| `seedSampleData` | owner-only | Writes to the sheet; with `USER_DEPLOYING` anyone holding the URL would otherwise be able to overwrite it. | Copy `assertDeployer()` for any new function that writes. |
| `oauthScopes` | `spreadsheets.currentonly` | Least privilege: only the bound spreadsheet. | Add scopes explicitly when you use `openById`, `UrlFetchApp`, etc. |
| `XFrameOptionsMode` | `DEFAULT` | Prevents embedding the app in third-party iframes. | `ALLOWALL` if you embed in Google Sites. |

## Things to keep in mind when you extend it

- Everything returned from a server function is visible to whoever can open the web app.
  Do not return rows the viewer should not see; filter on the server.
- Any exported function in `packages/gas/src/main.ts` can be invoked by any viewer via
  `google.script.run` — treat each one as a public endpoint and validate its arguments.
- Cell values are rendered as text by React; if you ever render HTML from sheet data,
  sanitize it first.
- Keep dependencies current (Dependabot is configured in `.github/dependabot.yml`).
