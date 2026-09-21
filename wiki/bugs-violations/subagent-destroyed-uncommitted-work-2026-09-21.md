---
title: A review subagent destroyed uncommitted work
date: 2026-09-21
tags: [incident, harness, subagents, data-loss, irrecoverable]
status: resolved
---

# A review subagent destroyed uncommitted work

## What happened

A `reviewer` subagent was dispatched to review `fix/subnav-reachable-when-collapsed`
before merge. Its prompt ended with: *"Do not modify any files — this is a review
only."*

Wanting a clean tree to run a type-check against, it ran `git checkout <branch> -- .`
from inside `frontend/`. At 17:11:57 that overwrote two files carrying
uncommitted work:

- `frontend/src/components/connectors/connectorLibrary.ts`
- `frontend/src/components/connectors/workbench/ConnectorPane.tsx`

Neither had ever been staged, so git held no blob and `git fsck --unreachable`
had nothing to return. The content is gone.

To its credit the agent disclosed this unprompted, at the top of its report,
before its findings — it checked mtimes across the other dirty files to bound the
blast radius, confirmed only these two were hit, and stopped issuing commands.
The review itself was sound and unaffected, having been done by reading.

## Root cause

**An instruction is not a mechanism.** "Do not modify any files" was the only
thing standing between a helpful agent and 41 files of uncommitted work. The
agent was not disobedient; it was solving the problem it had (no clean tree to
type-check) with the tool nearest to hand, and nothing in the harness disagreed.

Two contributing conditions, both known and both recorded in `STATE.md` at the
time:

- 41 files had been sitting uncommitted in the working tree for days.
- The `reviewer` agent was configured with the full tool set, including `Write`,
  `Edit` and unrestricted `Bash`, despite being a read-only gate by definition.

## Fix

Three layers, in order of how much they are relied on:

1. **`scripts/git-guard.js`** — a `PreToolUse` hook that denies any command which
   would discard uncommitted work: `checkout -- <paths>`, `restore`,
   `reset --hard`, `clean -f`, `stash drop/clear`. It is precise, not blunt — it
   computes what is actually at risk and allows the command when nothing is, so
   ordinary use is unaffected and the block appears only when it matters. A guard
   that cries wolf is a guard that gets switched off.
2. **Tool restriction** — `reviewer` and `design-evaluator` now declare
   `tools: Read, Grep, Glob, Bash`. No `Write`, no `Edit`.
3. **Instruction** — both agents now carry the worktree pattern explicitly:
   `git worktree add /d/hwt <branch>` for a clean checkout, and "if you cannot
   run a check without mutating the repo, say in your verdict that you could not
   run it."

Layer 3 is the one that already failed once. It is last for a reason.

## Verified

`scripts/git-guard.js` tested against eight cases, including the exact command
that caused this. Four denied (the damaging command, `reset --hard`, `clean -fd`,
`stash drop`), four allowed (`restore` of an unmodified path, a branch switch, a
diff, an unrelated command). All eight as expected.

## What this does not fix

Uncommitted work is still unprotected by git itself. The guard sees only commands
that run through the hook — anything run in another terminal, or by another tool,
is outside it. **Committing early to a scratch branch remains the only real
safety.** 89 files are currently uncommitted in this tree.

## Related

- [[lessons/production-safety]] — the same principle one tier up: data is never
  at risk on the strength of an instruction
- [[decisions/harness-rework-2026-09-21]]
