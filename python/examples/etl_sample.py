"""Example ETL: pull a public CSV, reshape it with pandas, push it to the `data` tab.

    python examples/etl_sample.py <spreadsheet id or url>

The first run opens a browser once (OAuth consent); afterwards the cached
.secrets/token.json is reused and the script runs unattended.
"""

from __future__ import annotations

import sys

import pandas as pd

from gasstart_sheets import get_client, write_df

# Any CSV with a date and some numeric columns works; this one is small and public.
SOURCE = "https://raw.githubusercontent.com/plotly/datasets/master/finance-charts-apple.csv"


def extract() -> pd.DataFrame:
    return pd.read_csv(SOURCE)


def transform(raw: pd.DataFrame) -> pd.DataFrame:
    """Wide -> long (date, category, value), matching the dashboard schema."""
    df = raw.rename(columns={"Date": "date"})
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    keep = {"AAPL.Open": "Open", "AAPL.High": "High", "AAPL.Close": "Close"}
    long = (
        df[["date", *keep]]
        .rename(columns=keep)
        .melt(id_vars="date", var_name="category", value_name="value")
        .sort_values(["date", "category"])
        .tail(90 * len(keep))  # last 90 trading days
        .reset_index(drop=True)
    )
    long["value"] = long["value"].round(2)
    return long


def load(df: pd.DataFrame, spreadsheet: str) -> None:
    gc = get_client()
    n = write_df(gc, spreadsheet, "data", df)
    print(f"Wrote {n} rows to '{spreadsheet}' / data")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    load(transform(extract()), sys.argv[1])
