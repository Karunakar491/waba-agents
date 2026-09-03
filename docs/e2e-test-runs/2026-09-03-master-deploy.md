---
date: 2026-09-03
type: process
tags: [deployment, frontend, kill-switch, feature-flag, traceability]
status: active
---

# Deploy record — master frontend, Unpublish UI flagged off (2026-09-03)

## What shipped

Commit `f299706`. **First deploy since 2026-08-25 that maps to an exact
commit** — every one in between needed a hand-applied strip to build, so
production corresponded to no commit at all (TASKS.md #18).

User-visible change: **none, by design.** The Unpublish feature landed in code
to repair the master build and is switched off at the flag.

## Pre-deploy findings

**V54 and V55 were already applied to production on 2026-08-20.** So this was a
code-only deploy — no migration ran, and the backup-before-migration rule was
not triggered (a backup was taken anyway).

The risk that replaced it was Flyway checksum validation: if the committed
`.sql` differed at all from what was applied, the app would refuse to start.
V54 on the server was byte-identical (sha `82b7307d…`, 860 bytes). V55's file
was **absent from the server** and unrecoverable, so its checksum was computed
directly — reimplementing Flyway's per-line CRC32 and validating the
implementation against V54's known recorded value first:

| Migration | Computed | Recorded | |
|---|---|---|---|
| V54 | `-2093105549` | `-2093105549` | algorithm validated |
| V55 | `1897906656` | `1897906656` | match — safe |

Two earlier readings were **wrong and corrected before acting**: `unzip` is not
installed on the box, so an empty result was misread as "migrations absent from
the jar"; and an auth-gated API returns 401 for every path including nonsense
ones, so endpoint probing proved nothing.

## Kill Switch

| Requirement | How it was met |
|---|---|
| Feature flag | `VITE_FEATURE_UNPUBLISH_UI`, defaults off when unset |
| Reversible < 5 min | static file swap, no restart, no DB |
| Verified-restorable backup | `/tmp/metaagent-backup-20260903154655.tar.gz`, 10 entries, `index.html` present, **copied off-box** and re-listed locally (300,328 bytes) |
| Data untouched | frontend static files only; backend never restarted |
| Canary | **none — named exception.** Single nginx box, no load balancer, no fractional-traffic mechanism. Same justification as the 2026-09-03 StepBasics deploy. Mitigated by zero user-visible change, off-box backup, and byte-level verification. |

**Rollback (code only, no data):**
```bash
sudo rsync -a --delete /tmp/restore/ /var/www/metaagent/   # after extracting the backup
# or: sudo tar xzf /tmp/metaagent-backup-20260903154655.tar.gz -C /var/www/metaagent
sudo chown -R www-data:www-data /var/www/metaagent
```
Off-box copy also in the session scratchpad.

**Rollback triggers:** non-200 on index.html or asset; served md5 ≠ local build
md5; an Unpublish button visible anywhere in the UI; founder reports the app
failing to load.

## Build discipline

Built from a **clean detached worktree** at `f299706`, not the main tree — which
carries ~60 files of unrelated uncommitted WIP that would otherwise have shipped
silently. `frontend/.env.production` is gitignored and was copied in explicitly;
without it the build silently falls back to `http://localhost:8080/api/v1` and
ships a dead app. Verified in the artifact: `baseURL:` `/api/v1`, and zero
occurrences of `localhost:8080`.

## Verification

| Check | Result |
|---|---|
| Transfer integrity | 301,691 bytes / md5 `43a0bc6e…` — identical both ends |
| Backup integrity pre-swap | 10 entries, `index.html` present |
| Backup off-box, re-listed locally | 10 entries readable |
| Pre-swap assertions on staged tree | `index.html` + `index-CEDyBwb2.js` present, referenced once |
| Swap method | `rsync -a --delete` (closes the non-atomic `rm -rf`→`cp` 404 window flagged as debt in the previous deploy) |
| Ownership preserved | `www-data:www-data`, mode 644 — captured pre-swap, restored after |
| Served index.html (Host hdr) | HTTP 200, references `assets/index-CEDyBwb2.js` |
| Served asset | HTTP 200 |
| **Served asset md5 vs local build** | `c6bafc7c62a8c34fc7db51d1ef04fe3e` — **exact match** |
| Old bundle removed | `index-BJ3xqz-6.js` → 404 (no stale files) |
| **Flag off in served bytes** | `var jm=Am(void 0)` with `Am(e){return e===\`true\`}` → **false** |
| Backend untouched | `systemctl is-active metaagent` → `active`; API → 401 (auth working) |
| Public path end-to-end | `https://app.karix.online/` → 200, new bundle, flag proof present |

A bare `curl http://localhost/index.html` returned 404 — diagnosed, not
reacted to: nginx has no default server, and `server_name app.karix.online`
requires the Host header. Not a deploy fault.

## Outstanding

- **No browser smoke test.** Byte-level proof shows the guard is false; it does
  not show the app renders. There is still no Playwright in this repo and no
  test WABA. Worth a founder glance at `app.karix.online`.
- Four findings still open against the Unpublish feature before the flag is
  turned on: unsafe Delete asymmetry (irreversible Delete fires on `onClick`
  with no confirmation while reversible Unpublish gets a confirm modal), wrong
  button styling, diff-size violation, and the flag itself (now closed).
- Backend was **not** redeployed. The server's source tree contains the
  unpublish backend already, so the running jar is believed current — but it was
  built on the box, not from a commit, so **backend traceability is still
  unresolved**. Frontend is now traceable; backend is not.

## Related
- [[../jobs/flag-off-unpublish-ui|Job: flag off the Unpublish UI]]
- [[../jobs/repair-master-build-unpublish|Job: repair the master build]]
- [[2026-09-03-master-build-repaired|Clean-checkout build verification]]
