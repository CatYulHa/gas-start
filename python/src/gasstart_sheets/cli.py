"""Command-line interface: ``gasstart-sheets <command>``."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import pandas as pd
import typer

from . import __version__
from .auth import AuthError, auth_mode, get_client, revoke_token
from .sample import sample_frame
from .sheets import read_df, write_df

app = typer.Typer(
    help="Read/write Google Sheets as pandas DataFrames using a cached OAuth token.",
    no_args_is_help=True,
)

SpreadsheetArg = Annotated[str, typer.Argument(help="Spreadsheet id, URL, or exact title")]
WorksheetArg = Annotated[str, typer.Argument(help="Worksheet (tab) name")]


def _client():
    try:
        return get_client()
    except AuthError as e:
        typer.secho(str(e), fg=typer.colors.RED, err=True)
        raise typer.Exit(2) from None


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(f"gasstart-sheets {__version__}")
        raise typer.Exit()


@app.callback()
def _main(
    version: Annotated[
        bool,
        typer.Option("--version", help="Show version and exit", callback=_version_callback, is_eager=True),
    ] = False,
) -> None:
    """Read/write Google Sheets as pandas DataFrames using a cached OAuth token."""


@app.command()
def auth(
    reset: Annotated[
        bool, typer.Option("--reset", help="Delete the cached token and re-authenticate")
    ] = False,
) -> None:
    """Sign in once in the browser and cache the token (later commands need no browser).

    Without a .secrets/credentials.json of your own this uses pydata-google-auth's
    built-in OAuth client, so no Google Cloud project is needed.
    """
    if reset and revoke_token():
        typer.echo("Removed cached token(s)")
    mode, tok = auth_mode()
    had_token = tok.is_file()
    _client()
    typer.secho("Authenticated.", fg=typer.colors.GREEN)
    typer.echo(f"  mode          : {mode}")
    typer.echo(f"  cached token  : {tok} ({'reused' if had_token else 'created'})")


@app.command()
def read(
    spreadsheet: SpreadsheetArg,
    worksheet: WorksheetArg = "data",
    out: Annotated[
        Path | None, typer.Option("--out", "-o", help="Write CSV here instead of printing")
    ] = None,
    limit: Annotated[int, typer.Option("--limit", "-n", help="Rows to print (0 = all)")] = 20,
) -> None:
    """Read a worksheet into a DataFrame and print it (or save as CSV)."""
    df = read_df(_client(), spreadsheet, worksheet)
    if out:
        df.to_csv(out, index=False)
        typer.echo(f"Wrote {len(df)} rows x {len(df.columns)} cols to {out}")
        return
    with pd.option_context("display.max_columns", None, "display.width", 200):
        typer.echo(df.head(limit).to_string(index=False) if limit else df.to_string(index=False))
    typer.echo(f"\n[{len(df)} rows x {len(df.columns)} cols]")


@app.command()
def write(
    csv: Annotated[Path, typer.Argument(help="CSV file to upload", exists=True, dir_okay=False)],
    spreadsheet: SpreadsheetArg,
    worksheet: WorksheetArg = "data",
    append: Annotated[
        bool, typer.Option("--append", help="Append below existing rows instead of replacing")
    ] = False,
    allow_formulas: Annotated[
        bool,
        typer.Option(
            "--allow-formulas",
            help="Let cells starting with = + - @ become live formulas (default: written as text)",
        ),
    ] = False,
) -> None:
    """Upload a CSV file to a worksheet (replaces the tab's contents by default)."""
    gc = _client()
    df = pd.read_csv(csv)
    if append:
        existing = read_df(gc, spreadsheet, worksheet)
        df = pd.concat([existing, df], ignore_index=True)
    n = write_df(gc, spreadsheet, worksheet, df, allow_formulas=allow_formulas)
    typer.echo(f"Wrote {n} rows to '{worksheet}'")


@app.command()
def seed(
    spreadsheet: SpreadsheetArg,
    worksheet: WorksheetArg = "data",
    days: Annotated[int, typer.Option(help="Number of days of sample data")] = 90,
) -> None:
    """Fill a worksheet with sample (date, category, value) rows for the dashboard."""
    df = sample_frame(days=days)
    n = write_df(_client(), spreadsheet, worksheet, df)
    typer.echo(f"Seeded {n} rows ({days} days x {df['category'].nunique()} categories) into '{worksheet}'")


if __name__ == "__main__":
    app()
