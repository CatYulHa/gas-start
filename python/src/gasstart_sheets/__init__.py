"""gasstart-sheets — Google Sheets <-> pandas with a cached OAuth token.

Typical use::

    from gasstart_sheets import get_client, read_df, write_df

    gc = get_client()                       # first run opens a browser, then reuses .secrets/token.json
    df = read_df(gc, "<spreadsheet id or url>", "data")
    write_df(gc, "<spreadsheet id or url>", "data", df)
"""

from .auth import DEFAULT_CREDENTIALS, DEFAULT_TOKEN, get_client
from .sheets import open_spreadsheet, read_df, write_df

__all__ = [
    "DEFAULT_CREDENTIALS",
    "DEFAULT_TOKEN",
    "get_client",
    "open_spreadsheet",
    "read_df",
    "write_df",
]

__version__ = "0.1.0"
