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

<!-- Sections 3–6 appended as each commit lands. -->
