---
date: 2026-09-03
type: process
tags: [deployment, frontend, kill-switch, devops-gate, canary-exception]
status: active
---

# Deploy record — Create Agent Step 1 phone-number fix (2026-09-03)

## Context
Founder hit a hard block in the Create Agent wizard: Step 1 flagged a phone number as "This number already belongs to another agent" for a number the user's *own* agent had just been bound to, permanently disabling Next.

## Decision / Event
Deployed frontend-only fix, commit `2aee0f3` (merged in master HEAD `9c3d120`).

**Root cause:** `StepBasics.tsx` built its "taken numbers" set from *all* agents, including the one being created/edited. After binding a number and clicking Back (`CreateAgentPage.tsx:215`) — or resuming a `sessionStorage` draft — Step 1 refetched `/agents` and flagged the agent's own number as belonging to "another agent". No way to proceed.

**Fix:** exclude the current agent (`a.id !== state.agentId`) from the taken-set, and name the actual owning agent by `displayName` in the message (never a raw agent ID, per founder instruction).

### Gates
- EL cold review: **APPROVE** (Fast Track — 1 file, ~15 net lines, no tokens/security/migration/infra)
- `tsc --noEmit`, `oxlint`: clean
- DevOps gate: **APPROVE** with 3 mandatory additions (functional smoke test, written canary justification, master-build debt logged)

### Verification (live)
| Check | Result |
|---|---|
| Transfer integrity | remote md5 `a15252f6…` == local, size 301122 == 301122 |
| Backup integrity, pre-swap | 10 entries, `index.html` present |
| Backup copied off-box, verified restorable | 10 entries readable locally |
| Pre-delete assertion on new tree | `index.html` + expected bundle present |
| Served index.html | HTTP 200, references new `index-BJ3xqz-6.js` |
| Served asset | HTTP 200 |
| **Served asset md5 vs local build** | `6c8767536da3906592592971da946634` — **exact match** |
| Fix string in served bundle | present |
| Old buggy string | gone |

## Rationale — no canary, stated explicitly (CLAUDE.md Hard Rule 7)
This deploy had **no canary / fractional rollout**, by named exception rather than oversight:

> The deploy mechanism does not support partial rollout. This is a single nginx box serving static files from `/var/www/metaagent` with no load balancer and no fractional-traffic mechanism. Building one is an EM-level infra project, out of scope for a one-file bug fix.

Accepted by the DevOps gate on that basis. Mitigations in place instead: verified-restorable backup taken immediately pre-swap *and* copied off-box, one-command rollback, byte-level proof of what's serving, and four named rollback triggers.

**Rollback (code+config only, no data):**
```bash
sudo rm -rf /var/www/metaagent/* && \
sudo tar xzf /tmp/metaagent-backup-20260903115552.tar.gz -C /var/www/metaagent
```
Off-box copy of that backup also held locally in the session scratchpad. Static files only — no service restart, no DB, well under 5 minutes.

**Rollback triggers:** non-200 on index.html or asset; served md5 != local build md5; served index.html still referencing the old hash; or founder reports Step 1 broken on live.

## Alternatives Considered
- Building from the main working tree — rejected; it carries ~55 files of unrelated uncommitted WIP that would have shipped silently.
- Committing the untracked unpublish components to make master build — rejected; unreviewed feature with known PM/UX/EL findings, and bundling it into an unrelated deploy violates scope discipline.

## Expected Outcome
Step 1 no longer blocks on the agent's own number; the ineligible message names the real owner.

## Actual Outcome
Deployed and byte-verified live. **Functional browser smoke test still outstanding** — DevOps mandated the founder run the exact repro on `app.karix.online` (bind a number → Back → confirm Next re-enables) since md5 match proves the new bytes are serving but not that the repro is fixed.

## Notes / debt surfaced
- Master HEAD does not build from a clean checkout — see [[../bugs-violations/master-head-unbuildable-2026-09-03|master un-buildable]]. This deploy needed a hand-applied build-only strip (5th occurrence). Deployed bundle therefore does not map to an exact commit.
- `frontend/.env.production` is gitignored; without recreating it in a clean worktree the build silently falls back to `http://localhost:8080/api/v1` (`src/lib/api.ts:5`) and ships a dead app. Worth making the build fail loudly instead.
- Non-blocking (DevOps): the `rm -rf` → `cp -r` swap is not atomic; sub-second 404 window. Suggested future improvement: `rsync --delete` or symlink swap.

## Related
- [[2026-08-25-session/frontend-deploy-runbook|Frontend Deploy Runbook]] — sequence followed here
- [[../bugs-violations/master-head-unbuildable-2026-09-03|master HEAD un-buildable]]
