# Delete what nothing uses

## Job

An engineer opens the frontend deciding where a change belongs, and is not
misled by screens and components that no longer exist in the product. Dead
modules cost nothing to run and a great deal to read: `ConnectorEditPage` was
replaced by the connector workbench and kept answering "where does connector
editing live?" with the wrong file.

## Proof

- `node scripts/dead-code.js`-style scan: 185 frontend modules, 18 imported by
  nothing; of those, 13 are `.test.ts` files (Jest runs them, nothing imports
  them) and 5 are genuinely unreferenced.
- Each of the 5 confirmed by grep at zero references outside its own file.
- `npx tsc --noEmit` → exit 0 with all five removed.

## Notes

Tracked files only, so every deletion is recoverable from git history.

`LiveOnMetaTable.tsx` is also unreferenced but is **not** deleted: it is
untracked, part of the uncommitted connector work, and the founder asked that
uncommitted features be left alone until discussed.

Removed:

| File | Lines | Why it is dead |
|---|---|---|
| `pages/ConnectorEditPage.tsx` | 364 | Superseded by `ConnectorWorkbenchPage`; no route, no import |
| `pages/SettingsPage.tsx` | 160 | No route. Only `TemplateSettingsPage` is wired |
| `components/templatestudio/CrossWabaHealthStrip.tsx` | 138 | No import |
| `components/library/LibraryItemCard.tsx` | 92 | Superseded by `LibraryTable` in the 2026-09-06 tables redesign |
| `hooks/useDebounce.ts` | 17 | No import |
