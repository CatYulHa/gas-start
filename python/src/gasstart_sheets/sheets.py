"""DataFrame <-> worksheet helpers.

The conversion is done here (not via gspread-dataframe) so that the logic is
small, predictable and unit-testable with a fake worksheet: a worksheet only
needs ``get_all_values()``, ``clear()``, ``resize()`` and ``update()``.
"""

from __future__ import annotations

import re
from typing import Any, Protocol

import gspread
import pandas as pd

_URL_RE = re.compile(r"/spreadsheets/d/([a-zA-Z0-9-_]+)")


class WorksheetLike(Protocol):
    """The subset of gspread.Worksheet these helpers rely on."""

    def get_all_values(self) -> list[list[str]]: ...
    def clear(self) -> Any: ...
    def resize(self, rows: int | None = None, cols: int | None = None) -> Any: ...
    def update(self, range_name: str, values: list[list[Any]], **kwargs: Any) -> Any: ...


def spreadsheet_key(ref: str) -> str | None:
    """Extract the spreadsheet id from a URL, or return ``ref`` if it already looks like an id."""
    m = _URL_RE.search(ref)
    if m:
        return m.group(1)
    if re.fullmatch(r"[a-zA-Z0-9-_]{25,}", ref):
        return ref
    return None


def open_spreadsheet(gc: gspread.Client, ref: str) -> gspread.Spreadsheet:
    """Open by URL, by id, or (fallback) by title."""
    key = spreadsheet_key(ref)
    if key:
        return gc.open_by_key(key)
    return gc.open(ref)


def get_worksheet(spreadsheet: gspread.Spreadsheet, name: str, *, create: bool = False) -> gspread.Worksheet:
    try:
        return spreadsheet.worksheet(name)
    except gspread.WorksheetNotFound:
        if not create:
            names = ", ".join(ws.title for ws in spreadsheet.worksheets())
            raise gspread.WorksheetNotFound(f"Worksheet '{name}' not found. Available: {names}") from None
        return spreadsheet.add_worksheet(title=name, rows=100, cols=20)


# --------------------------------------------------------------------------- read


def values_to_df(values: list[list[str]], *, numeric: bool = True) -> pd.DataFrame:
    """Turn raw cell values (first row = header) into a DataFrame.

    * Blank rows and unnamed trailing columns are dropped.
    * With ``numeric=True`` columns that parse cleanly as numbers become numeric.
    """
    if not values:
        return pd.DataFrame()

    header = [str(h).strip() for h in values[0]]
    width = len(header)
    body = []
    for raw in values[1:]:
        row = list(raw[:width]) + [""] * (width - len(raw))
        if all(str(c).strip() == "" for c in row):
            continue
        body.append(row)

    df = pd.DataFrame(body, columns=header)
    df = df.loc[:, [c for c in df.columns if c != ""]]
    df = df.replace({"": pd.NA})

    if numeric:
        for col in df.columns:
            converted = pd.to_numeric(df[col], errors="coerce")
            non_null = df[col].notna()
            if non_null.any() and converted[non_null].notna().all():
                df[col] = converted
    return df.reset_index(drop=True)


def read_df(gc: gspread.Client, spreadsheet: str, worksheet: str, *, numeric: bool = True) -> pd.DataFrame:
    """Read a worksheet (header in row 1) into a DataFrame."""
    ws = get_worksheet(open_spreadsheet(gc, spreadsheet), worksheet)
    return values_to_df(ws.get_all_values(), numeric=numeric)


# -------------------------------------------------------------------------- write


_FORMULA_PREFIX = ("=", "+", "-", "@", "\t", "\r")


def df_to_values(df: pd.DataFrame, *, index: bool = False, allow_formulas: bool = False) -> list[list[Any]]:
    """Serialise a DataFrame to a header row + JSON-safe cell values.

    Strings that a spreadsheet would interpret as formulas (``=SUM(...)``, ``+1``,
    ``-x``, ``@name``) are prefixed with ``'`` so they stay literal text — CSV
    formula injection (``=IMPORTXML(...)`` exfiltration, ``=HYPERLINK`` phishing)
    is a classic attack on sheets fed from untrusted files. Pass
    ``allow_formulas=True`` only for data you generated yourself.
    """
    frame = df.reset_index() if index else df
    header = [_text(str(c), allow_formulas) for c in frame.columns]
    rows: list[list[Any]] = [header]
    for record in frame.itertuples(index=False, name=None):
        rows.append([_cell(v, allow_formulas) for v in record])
    return rows


def _text(s: str, allow_formulas: bool) -> str:
    if not allow_formulas and s.startswith(_FORMULA_PREFIX):
        return "'" + s
    return s


def _cell(v: Any, allow_formulas: bool = False) -> Any:
    if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NA or v is pd.NaT:
        return ""
    if isinstance(v, pd.Timestamp):
        return v.strftime("%Y-%m-%d") if v == v.normalize() else v.isoformat(sep=" ")
    if hasattr(v, "isoformat"):  # datetime.date / datetime.datetime
        return v.isoformat()
    if hasattr(v, "item"):  # numpy scalar -> python scalar
        v = v.item()
    if isinstance(v, str):
        return _text(v, allow_formulas)
    if isinstance(v, bool | int | float):
        return v
    return _text(str(v), allow_formulas)


def write_values(ws: WorksheetLike, values: list[list[Any]], *, clear: bool = True) -> None:
    if clear:
        ws.clear()
    if not values:
        return
    n_rows, n_cols = len(values), max(len(r) for r in values)
    ws.resize(rows=max(n_rows, 1), cols=max(n_cols, 1))
    ws.update("A1", values, value_input_option="USER_ENTERED")


def write_df(
    gc: gspread.Client,
    spreadsheet: str,
    worksheet: str,
    df: pd.DataFrame,
    *,
    index: bool = False,
    clear: bool = True,
    create: bool = True,
    allow_formulas: bool = False,
) -> int:
    """Write ``df`` to a worksheet (creating it if needed). Returns the number of data rows written.

    ``allow_formulas=False`` (default) neutralises formula-like strings — see :func:`df_to_values`.
    """
    ws = get_worksheet(open_spreadsheet(gc, spreadsheet), worksheet, create=create)
    values = df_to_values(df, index=index, allow_formulas=allow_formulas)
    write_values(ws, values, clear=clear)
    return len(values) - 1
