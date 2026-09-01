# Contributing

Thanks for helping improve GasStart!

## Development setup

```bash
npm install                      # all JS workspaces
npm run typecheck && npm run build
npm run dev                      # dashboard on http://localhost:5173 with mock data

cd python
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
pytest && ruff check .
```

## Ground rules

- `AGENTS.md` is the canonical instruction file for AI coding tools; `CLAUDE.md`, `.cursor/rules/*`, `.windsurf/rules/*`, `.github/copilot-instructions.md` are pointers — change rules only in `AGENTS.md`.
- Keep `packages/shared` free of runtime dependencies — it is bundled into both the
  Apps Script backend and the dashboard.
- Any new server function callable from the dashboard must be added to `ServerApi`
  in `packages/shared/src/index.ts` **and** to `globals` in `packages/gas/vite.config.ts`.
- Never commit `.clasp.json`, `.clasp.*.json` (except the example), or anything in `.secrets/`.
- Run `npm run build` before opening a PR; CI asserts the single-file output has no
  external `<script src>` / `<link href>` and `Code.js` has no `export`/`import`.

## Pull requests

1. Fork and branch from `main`.
2. Keep changes focused; update the README if behaviour or commands change.
3. Make sure CI passes.
