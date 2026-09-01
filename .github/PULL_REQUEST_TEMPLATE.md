## What

<!-- One or two sentences. Link the issue if there is one: Closes #123 -->

## Checklist

- [ ] `npm run check` passes (typecheck + build)
- [ ] If a server function was added/changed: `main.ts` export + `ServerApi` in `packages/shared` + `globals` in `packages/gas/vite.config.ts` (see `AGENTS.md`)
- [ ] `npm run dev` still works with mock data (update `src/mock/data.json` if the schema changed)
- [ ] Python touched? `pytest` and `ruff check .` pass in `python/`
- [ ] Docs updated if behaviour or commands changed
