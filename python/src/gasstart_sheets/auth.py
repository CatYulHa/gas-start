"""Authentication with a cached user token.

This mirrors the classic Google API quickstart pattern (``token.pickle``):

1. You download an OAuth client secret ("Desktop app") once -> ``credentials.json``.
2. The first call opens a browser for consent and stores the resulting refresh
   token in ``token.json``.
3. Every later call reuses ``token.json`` silently (access tokens are refreshed
   automatically). No browser, no re-consent, until you delete the file or the
   refresh token is revoked.

gspread implements exactly this via :func:`gspread.oauth`; we only fix the file
locations (project-local ``.secrets/`` by default, git-ignored) and add a
service-account escape hatch for CI/bots.

Environment overrides:

* ``GASSTART_CREDENTIALS``     path to the OAuth client file
* ``GASSTART_TOKEN``           path to the cached user token
* ``GASSTART_SERVICE_ACCOUNT`` path to a service-account JSON; when set, the
  user-token flow is skipped entirely
"""

from __future__ import annotations

import os
from pathlib import Path

import gspread

SECRETS_DIRNAME = ".secrets"


def find_secrets_dir(start: Path | None = None) -> Path:
    """Locate the ``.secrets`` directory.

    Walks up from ``start`` (default: current directory) and returns the first
    existing ``.secrets`` folder — so the CLI works from the repo root, from
    ``python/``, or from any sub-folder. If none exists yet, falls back to
    ``<start>/.secrets`` (created on first authentication).
    """
    start = (start or Path.cwd()).resolve()
    for folder in (start, *start.parents):
        candidate = folder / SECRETS_DIRNAME
        if candidate.is_dir():
            return candidate
    return start / SECRETS_DIRNAME


SECRETS_DIR = find_secrets_dir()
DEFAULT_CREDENTIALS = SECRETS_DIR / "credentials.json"
DEFAULT_TOKEN = SECRETS_DIR / "token.json"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]


class AuthError(RuntimeError):
    """Raised when no usable credentials can be found."""


def resolve_paths(
    credentials: str | os.PathLike[str] | None = None,
    token: str | os.PathLike[str] | None = None,
) -> tuple[Path, Path]:
    """Return (credentials_path, token_path) honouring args, env vars, then defaults."""
    cred = Path(credentials or os.environ.get("GASSTART_CREDENTIALS") or DEFAULT_CREDENTIALS)
    tok = Path(token or os.environ.get("GASSTART_TOKEN") or DEFAULT_TOKEN)
    return cred, tok


def get_client(
    credentials: str | os.PathLike[str] | None = None,
    token: str | os.PathLike[str] | None = None,
    *,
    scopes: list[str] | None = None,
) -> gspread.Client:
    """Return an authorised :class:`gspread.Client`.

    Uses a service account if ``GASSTART_SERVICE_ACCOUNT`` is set, otherwise the
    cached-user-token flow described in the module docstring.
    """
    sa = os.environ.get("GASSTART_SERVICE_ACCOUNT")
    if sa:
        sa_path = Path(sa)
        if not sa_path.is_file():
            raise AuthError(f"GASSTART_SERVICE_ACCOUNT points to a missing file: {sa_path}")
        return gspread.service_account(filename=str(sa_path), scopes=scopes or SCOPES)

    cred_path, token_path = resolve_paths(credentials, token)

    if not token_path.is_file() and not cred_path.is_file():
        raise AuthError(
            f"No cached token at {token_path} and no OAuth client file at {cred_path}.\n"
            "Create an OAuth client ID of type 'Desktop app' in Google Cloud Console "
            "(APIs & Services -> Credentials), download the JSON and save it as "
            f"{cred_path}. Then run `gasstart-sheets auth` once to create the token."
        )

    token_path.parent.mkdir(parents=True, exist_ok=True)
    return gspread.oauth(
        scopes=scopes or SCOPES,
        credentials_filename=str(cred_path),
        authorized_user_filename=str(token_path),
    )


def revoke_token(token: str | os.PathLike[str] | None = None) -> bool:
    """Delete the cached token so the next call re-runs the browser consent. Returns True if removed."""
    _, token_path = resolve_paths(None, token)
    if token_path.is_file():
        token_path.unlink()
        return True
    return False
