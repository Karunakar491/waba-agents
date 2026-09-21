# Agent harness rework (ledger + loop + collapsed personas)

## Job

Karunakar opens the repo deciding whether the agent system is thinking about the
whole product or only its current slice; he sees `STATE.md` — one ranked file
holding what is live, what is broken by user impact, and what is unmerged — and
`node scripts/orient.js` printing that reality on demand, because the nine
persona gates described in CLAUDE.md were never built and the system had no
model of reality to reason against.

## Proof

`docs/e2e-test-runs/2026-09-21-harness-rework.md` — real command output from each
new script:

- `node scripts/orient.js` — offline run reporting deploy drift, the six unmerged
  branches, the open job, and the top Broken entries
- `node scripts/ledger-check.js` — warns on a code-touching session with no
  `STATE.md` change, silent on a docs-only session
- `node scripts/session-context.js` — emits the ledger on SessionStart
- `node scripts/commit-gate.js` — still denies a commit with no active job
  (the existing gate must not regress)
- `wc -l CLAUDE.md` — under 100 lines

## Notes

Design spec: `docs/superpowers/specs/2026-09-21-agent-harness-rework-design.md`.

Ships as four commits under the 400-line cap: ledger + probe, harness hooks,
CLAUDE.md rewrite, agent collapse.

Replaces the maker-checker gate system in `wiki/decisions/maker-checker.md` and
deletes `AGENT-WORKFLOW.md` entirely.
