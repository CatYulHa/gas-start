"""Authentication with a cached user token.

Two user-token flows are supported; both mirror the classic Google API
quickstart pattern (``token.pickle``): a browser consent screen once, then a
refresh token cached on disk that every later call reuses silently.

**Zero-setup (default when no ``credentials.json`` exists)** — ``pydata-google-auth``
ships its own OAuth client, so you do not need a Google Cloud project at all:

1. First call opens the browser; sign in with the Google account that owns (or
   was given access to) the spreadsheets you want to touch.
2. The credentials are cached user-wide (``%APPDATA%\\gasstart`` on Windows,
   ``~/.config/gasstart`` elsewhere) and reused from any project on this machine.

**Own OAuth client (when ``.secrets/credentials.json`` exists)** — download an
OAuth client secret ("Desktop app") from your own Cloud project; the token is
cached project-locally in ``.secrets/token.json`` (git-ignored). Use this when
your organisation blocks third-party OAuth clients or you want your own consent
screen branding.

**Service account (CI/bots)** — set ``GASSTART_SERVICE_ACCOUNT`` to a service
account JSON and share the sheet with its e-mail; no browser is involved.

Environment overrides:

* ``GASSTART_CREDENTIALS``     path to the OAuth client file
* ``GASSTART_TOKEN``           path to the cached user token (own-client flow)
* ``GASSTART_SERVICE_ACCOUNT`` path to a service-account JSON; when set, the
  user-token flows are skipped entirely
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
        if (folder / ".git").exists():
            break  # stop at the repository root — never pick up a .secrets/ planted above it
    return start / SECRETS_DIRNAME


SECRETS_DIR = find_secrets_dir()
DEFAULT_CREDENTIALS = SECRETS_DIR / "credentials.json"
DEFAULT_TOKEN = SECRETS_DIR / "token.json"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

# pydata-google-auth cache: one file per user, shared by every project on the machine.
PYDATA_CACHE_DIRNAME = "gasstart"
PYDATA_CACHE_FILENAME = "google_user_credentials.json"


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
        # No OAuth client of your own -> use pydata-google-auth's built-in client.
        return _pydata_client(scopes or SCOPES)

    token_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    client = gspread.oauth(
        scopes=scopes or SCOPES,
        credentials_filename=str(cred_path),
        authorized_user_filename=str(token_path),
    )
    _restrict_permissions(token_path)
    return client


def _pydata_cache():
    """The pydata-google-auth credentials cache used by the zero-setup flow."""
    from pydata_google_auth.cache import ReadWriteCredentialsCache

    return ReadWriteCredentialsCache(dirname=PYDATA_CACHE_DIRNAME, filename=PYDATA_CACHE_FILENAME)


def pydata_cache_path() -> Path:
    """Where the zero-setup flow stores the cached user credentials."""
    return Path(_pydata_cache()._path)


def _pydata_client(scopes: list[str]) -> gspread.Client:
    """Browser consent once via pydata-google-auth's own OAuth client, then a cached token.

    Google shows an "unverified app" warning for the Sheets scope on the first
    consent; that is expected for the shared client (Advanced -> Go to ... -> Allow).
    """
    try:
        import pydata_google_auth
    except ImportError as e:  # pragma: no cover - dependency is declared, but be explicit
        raise AuthError(
            "pydata-google-auth is not installed. Run `pip install pydata-google-auth`, "
            "or provide your own OAuth client file (see python/README.md)."
        ) from e

    creds = pydata_google_auth.get_user_credentials(
        scopes,
        credentials_cache=_pydata_cache(),
        use_local_webserver=True,
    )
    _restrict_permissions(pydata_cache_path())
    return gspread.authorize(creds)


def auth_mode() -> tuple[str, Path]:
    """Report which flow :func:`get_client` will use and where its token lives."""
    sa = os.environ.get("GASSTART_SERVICE_ACCOUNT")
    if sa:
        return "service-account", Path(sa)
    cred_path, token_path = resolve_paths()
    if token_path.is_file() or cred_path.is_file():
        return "oauth-client", token_path
    return "pydata", pydata_cache_path()


def _restrict_permissions(path: Path) -> None:
    """Best effort: the cached token holds a refresh token, so keep it owner-only (no-op on Windows ACLs)."""
    try:
        if path.is_file():
            os.chmod(path, 0o600)
    except OSError:
        pass


def revoke_token(token: str | os.PathLike[str] | None = None) -> bool:
    """Delete the cached token(s) so the next call re-runs the browser consent. True if any removed."""
    removed = False
    _, token_path = resolve_paths(None, token)
    if token_path.is_file():
        token_path.unlink()
        removed = True
    cache = pydata_cache_path()
    if cache.is_file():
        cache.unlink()
        removed = True
    return removed
