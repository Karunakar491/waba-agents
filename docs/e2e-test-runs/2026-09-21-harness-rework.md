# Harness rework — proof

Real command output from each new script. Job: `docs/jobs/agent-harness-rework.md`.
Design: `docs/superpowers/specs/2026-09-21-agent-harness-rework-design.md`.

---

## 1. `node scripts/orient.js` — fails soft with no ledger

Run before `STATE.md` existed. Every section degraded to a `?` line; none threw:

```
STATE.md not found at repo root — the ledger is the centre of
the loop. Create it before orienting.

DEPLOYED
  ? STATE.md has no Live section — master is 80b4223

UNMERGED
  !! feature/draft-on-delete — 11 commits ahead of master
  ...

MOST BROKEN
  ? STATE.md has no Broken entries
```

## 2. `node scripts/orient.js` — against the real ledger

Offline. No SSH, no network, no production call.

```
DEPLOYED
  · Production host: 13.127.221.54 (/opt/metaagent)
  · Frontend: traceable to a commit since 2026-09-03; exact deployed SHA not recorded here yet — record it on the next deploy
  · Backend: maps to no revision. The running jar is built on the box from a synced source tree, not from a commit. /opt/metaagent/src is stale (V54 vs V56)
  OK master at time of writing: 80b4223

UNMERGED
  !! feature/draft-on-delete — 11 commits ahead of master
  !! iris/phase-1-agent-creation-tools — 8 commits ahead of master
  !! astrotalk-agent-build — 7 commits ahead of master
  !! feature/connector-action-backfill — 7 commits ahead of master
  !! fix/connector-published-badge — 2 commits ahead of master
  !! fix/outbound-echo-components — 2 commits ahead of master
  !! feature/image-header-preview — 1 commit ahead of master
  !! fix/subnav-reachable-when-collapsed — 1 commit ahead of master

JOB
  · action-send-and-response
  OK Proof section is filled

MOST BROKEN
  No human can ever reply in the Inbox. The agent is the only voice; there is no takeover path. A customer needing a person cannot reach one. → project_daily_user_challenges_audit_2026_09_03
  No conversation ever closes. Threads accumulate forever with no resolved state, so the Inbox cannot be worked as a queue. → same audit
  Agent latency is 11.6s. Far outside what a WhatsApp user will wait for. → same audit
  … 11 more in STATE.md

Before acting: is this the most valuable thing open, what does
it touch, and what could it break?
```

**The finding this surfaced on its first real run:** eight branches, 37 commits,
none merged — including two that fix top-ranked Broken entries
(`fix/outbound-echo-components`, `fix/subnav-reachable-when-collapsed`). The
design doc had estimated six branches from a hand count. The probe corrected it.
That is the point of the probe.

## 3. The harness hooks

`.claude/settings.json` parses: `VALID`.

**`scripts/session-context.js`** (SessionStart) — emits the ledger as
`additionalContext`, 5,411 chars / ~1,353 tok:

```
event: SessionStart
chars: 5411 ~1353 tok
# Current state of the product (injected from STATE.md)
This is the ledger. Read it before starting anything, write to it before
closing anything. Run `node scripts/orient.js` for the measured parts.
Before acting on any task, answer: is this the most valuable thing open,
what does it touch, and what could it break?
```

**`scripts/ledger-check.js`** (Stop) — warns when shipped code moved and the
ledger did not:

```
{"systemMessage":"STATE.md has not moved, but shipped code has.\n\n
29 uncommitted change(s) in shipped paths:
  backend/.../ConnectorLibraryDtos.java
  backend/.../ConnectorDeployment.java
  backend/.../ConnectorLibraryService.java
  backend/.../SkillLibraryController.java
  backend/.../SkillDtos.java
  … 24 more
```

**Finding on first run:** 29 uncommitted files sit in shipped backend paths,
unrelated to this job. Pre-existing, now visible.

Negative case — STATE.md dirty (the loop working) → `SILENT (correct)`.
Docs-only sessions do not trigger it: the `SHIPPED` filter is limited to
`frontend/src/`, `backend/src/main/` and `scripts/`.

**Regression check — `scripts/commit-gate.js` still hard-blocks** with the job
pointer removed:

```
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",
"permissionDecisionReason":"COMMIT BLOCKED — no active job. ...
```

## 4. Token cost

Measured, not estimated. `wc -c` ÷ 4.

| | Before | After |
|---|---|---|
| `docs/knowledge-index.json` read whole (CLAUDE.md: *"query before opening any file"*) | ~55,931 tok | — |
| `docs/knowledge-index.md` — one grep lookup | — | **~69 tok** (276 chars) |
| `docs/knowledge-index.md` whole file, if ever read | — | ~23,505 tok |

The JSON keyed 452 entries by meaningless numeric strings (`"0"`, `"76"`) and
split `path` and `purpose` onto separate lines, so a grep could never return
both. The `.md` is one line per file, sorted by path, 450 entries after two
duplicate paths were dropped.

Purposes were capped at ~200 chars on a sentence boundary. They had become
changelogs — the `AgentService.java` entry alone was ~5,000 characters, so a
two-hit grep returned 7,054 characters before the cap and 276 after. The
long-form text is preserved in `docs/knowledge-index.json` and in git history.

`node scripts/orient.js` now reports the budget on every run:

```
CONTEXT
  !! CLAUDE.md — ~5074 tok (cap 1200, loaded every turn)
  OK STATE.md — ~1283 tok (cap 2000, injected at SessionStart)
  · always-on total ~6357 tok
  !! docs/knowledge-index.json still present — ~55931 tok if read whole.
     Grep docs/knowledge-index.md instead.
  → something is over budget. Trim it or move it off the always-on path.
```

CLAUDE.md is deliberately still over budget here — the rewrite is the next commit.

## 5. CLAUDE.md

```
lines: 103  (was 349)
CONTEXT
  OK CLAUDE.md — ~1197 tok (cap 1200, loaded every turn)
  OK STATE.md — ~1430 tok (cap 2000, injected at SessionStart)
  · always-on total ~2627 tok
```

The budget was read as breached by 3 tokens until the estimator was corrected to
measure content rather than bytes on disk: CRLF adds a byte per line, inflating
CLAUDE.md by ~25 tokens. The fix was to the measurement, not to the prose — a cap
missed by a line-ending convention is a broken ruler, not a broken rule.

Cache-stability check — no dates and no SHAs in the always-on prefix, so an edit
does not invalidate the cached system prompt:

```
grep -nE '20[0-9]{2}-[0-9]{2}-[0-9]{2}|\b[0-9a-f]{7,40}\b' CLAUDE.md
(no output)
```

Done in two commits rather than one: a full-file rewrite is 349 deletions plus
104 additions, which cannot fit the 400-line cap the gate enforces. The fiction
was deleted first, then the replacement written — which reads better in history
anyway.

## 6. Agent collapse

Seven files (1,287 lines) to two:

| Was | Lines | Becomes |
|---|---|---|
| `persona-el.md`, `persona-ux.md`, `QA.md`, `devops-skill.md` | 713 | `reviewer.md` (99) |
| `persona-design-evaluator.md` | 79 | `design-evaluator.md` (114) |
| `persona-pm.md`, `persona-em.md` | 495 | deleted — judgment moves into ORIENT |

`.claude/agents/` is now tracked. The existing `!.claude/settings.json` negation
had never actually been doing anything: git does not descend into an excluded
directory, so no negation under `.claude/` can match. `settings.json` stayed
tracked only because it was added in `aaacc42` and `.gitignore` does not apply to
tracked files. The rule is now per-entry (`.claude/*`), verified:

```
git check-ignore -v .claude/settings.local.json .claude/agents/reviewer.md
.gitignore:30:.claude/*          .claude/settings.local.json     ← still ignored
.gitignore:38:!.claude/agents/*.md .claude/agents/reviewer.md    ← now tracked
```

## 7. Branch hygiene — a finding against my own work

The nine commits were made on `feature/draft-on-delete`, an unrelated feature
branch, because that is where the checkout happened to be. Merging that would
have carried 11 commits of unmerged draft-on-delete work into master under a
harness commit message — the exact failure the "stage files, not directories"
lesson records.

Fixed by cherry-picking all nine onto `master` in an isolated worktree, leaving
the working tree untouched:

```
git worktree add -b harness/rework-clean /d/hwt master
git cherry-pick 62b72c3..d3b1dfa
=== result: 9 commits ===
does harness/rework contain draft-on-delete work? 0 — clean
```

Verified from that bare master checkout: `orient.js` runs, `STATE.md` and all
three scripts present, `AGENT-WORKFLOW.md` gone, `CLAUDE.md` at 104 lines.

Two traps hit on the way, both recorded because they will recur on this machine:
the first worktree failed with `Filename too long` under the scratchpad path
(Windows limit plus deep Java package paths — use a short path like `/d/hwt`),
and `git cherry-pick A..B` excludes A, which silently dropped the first commit.

The main checkout was deliberately **not** moved to the clean branch: 41
uncommitted files sit in the tree, 14 of them overlapping
`feature/draft-on-delete`, so switching would have risked work that is not mine.
