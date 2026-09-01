# gasstart-sheets

Read and write Google Sheets as pandas DataFrames with a **cached OAuth token** — the
`token.pickle` pattern from the classic Google API quickstart, minus the boilerplate.

```bash
pip install -e ".[dev]"          # or: uv pip install -e ".[dev]"

gasstart-sheets auth              # 1st run: browser consent -> .secrets/token.json
gasstart-sheets seed  <SHEET_ID>  # sample rows into the `data` tab
gasstart-sheets read  <SHEET_ID> data --out data.csv
gasstart-sheets write data.csv <SHEET_ID> data
```

```python
from gasstart_sheets import get_client, read_df, write_df

gc = get_client()
df = read_df(gc, "https://docs.google.com/spreadsheets/d/<ID>/edit", "data")
write_df(gc, "<ID>", "summary", df.groupby("category", as_index=False)["value"].sum())
```

## Credentials

| File | What | How to get it |
|---|---|---|
| `.secrets/credentials.json` | OAuth client (type **Desktop app**) | Google Cloud Console → APIs & Services → Credentials → Create → OAuth client ID. Enable the **Google Sheets API** and **Google Drive API** for the project. |
| `.secrets/token.json` | Your cached user token | Created automatically on the first `auth`/`read`/`write`. Delete it (or `gasstart-sheets auth --reset`) to re-consent. |

Override locations with `GASSTART_CREDENTIALS` / `GASSTART_TOKEN`. For CI or bots set
`GASSTART_SERVICE_ACCOUNT=/path/sa.json` and share the sheet with that service account's
e-mail; the user-token flow is then skipped.

The `.secrets/` folder is looked up upward from the current directory (repo root, `python/`, …),
so the CLI works from anywhere inside the repo. It is git-ignored — never commit either file.

## Tests

```bash
pytest
```
