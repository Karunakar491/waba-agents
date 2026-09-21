# STATE

The product's true state. Read it before starting anything; write to it before
closing anything. This file is the centre of the loop — `CLAUDE.md` holds the
rules, this holds the reality.

**It is a ranked index, not an archive.** One or two lines per entry, then a
link into the detail. Long-form writeups live in `TASKS.md`, `wiki/` and
`docs/jobs/`. Prose duplicated here goes stale here first.

`node scripts/orient.js` checks the parts of this file a machine can measure.

_Last updated: 2026-09-21_

> The harness itself — `STATE.md`, the loop, the hooks, the two reviewers — is on
> `harness/rework`, nine commits on top of `master`, not yet merged.

## Live

- Production: `ubuntu@10.1.17.16`, reached through the bastion `ec2-user@13.232.241.246` (key `/d/karix-mcp/karix-interna-AI-POC.pem`). `13.127.221.54` in older notes is not reachable with the dev key.
- **Backend: `master` mirrors production** as of 2026-09-21 — V57 and V58 md5-match the running jar (built 04:49). Verified by reading the jar, which is the only reliable source: `/opt/metaagent/src` on the box is a fossil twelve days older than the jar, so never diff against it.
- **Connector backfill is fully live.** Phase B ran 05:00:04 on 2026-09-21 and matched its checklist prediction for prediction; the UI delete proved the RESTRICT ordering. Two IndiaMART connectors were marked gone from Meta — pre-state and the sign-off needed to restore them are in `wiki/deployment/connector-sync-2026-09-21-rollback-capture.md`.
- Frontend: traceable to a commit since 2026-09-03; **exact deployed SHA still not recorded** — record it on the next deploy.

> Deploy traps: build locally, never on the box; `unzip` is missing there; diff
> the jar's class list before every swap. `reference_production_deploy_traps_2026_09_18`.

## Broken

Ranked by user impact. The top entry is what a low-value task gets measured against.

- **No human can ever reply in the Inbox.** The agent is the only voice; there is no takeover path. A customer needing a person cannot reach one. → `project_daily_user_challenges_audit_2026_09_03`
- **No conversation ever closes.** Threads accumulate forever with no resolved state, so the Inbox cannot be worked as a queue. → same audit
- **Agent latency is 11.6s.** Far outside what a WhatsApp user will wait for. → same audit
- **Customer names are discarded** even though they are present in the webhook payload. Every conversation is anonymous for no reason. → same audit
- **Sub-nav is invisible on first login.** Skills, Connectors, Knowledge Base and Persona are unreachable because the rail defaults to collapsed. Routes work if typed. Fix committed on `fix/subnav-reachable-when-collapsed`, **not deployed**. → `project_subnav_hidden_when_collapsed_2026_09_18`
- **The Inbox discards every list and button the agent sends.** Fixed on `fix/outbound-echo-components` (also closes a duplicate-row webhook race), **not deployed**. → `project_outbound_components_2026_09_18`
- **Connectors deployed before 2026-09-18 never created their Meta tools**, so their agents can call nothing — and the UI still reads "In sync". New deployments are fixed; pre-existing ones are not. → `project_connector_tool_sync_2026_09_18`
- **Frontend deploy swap is not atomic** (`rm -rf` then `cp`). Live users can be served a broken app mid-deploy. Fix is a symlink swap.
- **Deleted agents keep their `phoneNumberId` forever**, so the number is permanently unpickable and the stale agent name surfaces in the Basics step. → `TASKS.md` #17
- **`bindPhone`'s onboarding gate is per-agent-row, not per-phone.** Rebinding to a different number scopes the settings call with the wrong `agent_id`. → `TASKS.md` #16
- **Backend test suite is red on master** (`ModuleAccessFilterTest`, `RateLimitFilterTest`), so it cannot gate a deploy.
- **The whole integration suite is dead on Docker 25+** until `testcontainers.version` is bumped. → `reference_testcontainers_docker_api_2026_09_16`
- **11 of 53 backend test files mock `MetaApiClient`** — all green through the 2026-08-25..09-01 outage when nobody could create an agent. `scripts/meta-check.js` now covers the read paths against real Meta; writes are still mock-only.
- **Nothing that writes is tested.** The e2e suite is read-only by default, so every button that *does* something — publish, deploy, send, delete — is unverified. A reserved test number now exists (see Constraints); the mutating journeys do not.
- **Skill detach has no UI**, so a library skill on three agents can still only be removed from all three. Backend is done and tested on `feature/skill-detach`. → `docs/jobs/skill-detach.md`
- **No UI inventory.** Nobody can say which screens and controls exist, let alone which are covered. `docs/UI-INVENTORY.md` is the fix and is not built.
- **The ledger was wrong about Astrotalk.** Memory recorded agent `887643060282855424` live on `+91 96422 01123`; that number is now `MIGRATED` and unbound, and an "Astrotalk 85916" sits on `+91 85916 89475`. Corrected here 2026-09-21. Assume other recorded Meta-side state has drifted too.
- **One RabbitMQ line is flooding the log** — "Failed to check/redeclare auto-delete queue(s)", 18,944 of 19,066 errors in a single day, roughly 1,400/hour. Harmless to users, and it is why the disk keeps filling.
- **Meta is rate-limiting us.** 429s ongoing since the backfill sweep went live: 89 in the 10:00 hour on 2026-09-21, still 3 at 13:00. The sweep raised per-agent GETs from ~4 to ~5. Nothing has failed yet; nothing is watching it either.
- **Connector delete has no automated cover.** Proven once by hand on 2026-09-21 (UI delete, no MySQL `1451`), but a stub repository cannot see a RESTRICT violation and Testcontainers is dead on Docker 25+, so a regression here would be silent.
- **No disk alerting.** `logrotate` landed 2026-09-06 after a third disk-full, but nothing warns before the next one. `/tmp` and `/var/www` hold ~500M of manual-deploy residue. → `wiki/bugs-violations/disk-full-app-log-2026-09-06.md`

## In flight

`node scripts/orient.js` lists the branches and their counts. Only what it
cannot work out for itself belongs here:

- `harness/rework` — this system. Clean on master, pushed, unmerged.
- `feature/skill-detach` — backend done, no UI. → `docs/jobs/skill-detach.md`
- `feature/draft-on-delete` — backend only, no UI; PM's "preserved draft" marker overridden and still open. → `project_draft_on_delete_2026_09_16`
- `harness/rework-on-draft` — scratch. Same commits on top of draft-on-delete, kept only because the working tree overlaps that branch. Delete once that clears.

**The working tree holds a lot of uncommitted work**, some overlapping
`feature/draft-on-delete`, so the checkout cannot move between branches safely.
Two files were destroyed on 2026-09-21 by a command that assumed otherwise;
`scripts/git-guard.js` now blocks that class of command.

## Constraints

Facts that bound a task. The rules themselves live in `CLAUDE.md` and are not
repeated here — both files load every session, so a duplicated rule costs twice
and drifts in one place first.

- **`+91 90100 11634` (`674661285722401`) is the reserved test number.** Free, CONNECTED, GREEN, on WABA `494227720434920`. Mutating e2e binds here and nowhere else. Never give it to a customer.
- **Every other number on the demo account is somebody's agent** and is never touched by a test: `+91 91520 04492` (smsa, paused), `+91 91520 04283`, `+91 91520 04195` (IndiaMART), `+91 85916 89475` (Astrotalk 85916), `+91 90100 82954` (Test-Internal, draft).
- **`+1 555-061-1133`** on WABA `100730486010852` is a Meta sandbox number — pre-verified recipients only, so it cannot prove a real customer journey.
