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

<!-- Section 5 (agent collapse) appended when that commit lands. -->
