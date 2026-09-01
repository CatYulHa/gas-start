# gasstart-sheets

Read and write Google Sheets as pandas DataFrames with a **cached user token** — the
`token.pickle` pattern from the classic Google API quickstart, minus the boilerplate.
Sign in once in the browser; every later call reuses the cached token.

```bash
pip install -e ".[dev]"          # or: uv pip install -e ".[dev]"

gasstart-sheets auth              # 1st run: browser sign-in -> token cached, no Cloud project needed
gasstart-sheets seed  <SHEET_ID>  # sample rows into the `data` tab
gasstart-sheets read  <SHEET_ID> data --out data.csv
gasstart-sheets write data.csv <SHEET_ID> data   # add --allow-formulas to let =... cells be formulas
```

```python
from gasstart_sheets import get_client, read_df, write_df

gc = get_client()
df = read_df(gc, "https://docs.google.com/spreadsheets/d/<ID>/edit", "data")
write_df(gc, "<ID>", "summary", df.groupby("category", as_index=False)["value"].sum())
```

## How sign-in works

`get_client()` picks the first flow that applies:

| Flow | When | Token lives in | Setup |
|---|---|---|---|
| **Zero-setup** (default) | no `.secrets/credentials.json` | `%APPDATA%\gasstart\google_user_credentials.json` (Windows) / `~/.config/gasstart/` | none — [pydata-google-auth](https://pydata-google-auth.readthedocs.io/) ships its own OAuth client. First run opens the browser; Google shows an "unverified app" warning for the Sheets scope — *Advanced → Go to … → Allow*. The token is per user, shared by every project on the machine. |
| **Own OAuth client** | `.secrets/credentials.json` exists | `.secrets/token.json` (project-local, git-ignored) | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (type **Desktop app**); enable the Sheets and Drive APIs. Use this if your organisation blocks third-party OAuth clients. |
| **Service account** | `GASSTART_SERVICE_ACCOUNT=/path/sa.json` | — | share the sheet with the service account e-mail. For CI and bots. |

You can access every spreadsheet the signed-in Google account can open — your own and the
ones shared with you. `gasstart-sheets auth --reset` deletes the cached token(s) to re-consent.

Override file locations with `GASSTART_CREDENTIALS` / `GASSTART_TOKEN`. The `.secrets/` folder is
looked up upward from the current directory (repo root, `python/`, …), so the CLI works from
anywhere inside the repo. It is git-ignored — never commit either file.

## Tests

```bash
pytest
```
