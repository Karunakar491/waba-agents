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

- Production host: `13.127.221.54` (`/opt/metaagent`)
- Frontend: traceable to a commit since 2026-09-03; **exact deployed SHA not recorded here yet** — record it on the next deploy
- Backend: **maps to no revision.** The running jar is built on the box from a synced source tree, not from a commit. `/opt/metaagent/src` is stale (V54 vs V56)
- `master` at time of writing: `80b4223`

> Deploy traps, verified 2026-09-18: master is production's line, not the feature
> branch; `unzip` is missing on the box; diff the jar's class list before every
> swap. See `reference_production_deploy_traps_2026_09_18` in memory.

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
- **Nothing that writes is tested.** The e2e suite is read-only by default, so every button that *does* something — publish, deploy, send, delete — is unverified. A reserved test number now exists (see Constraints); the mutating journeys do not.
- **No UI inventory.** Nobody can say which screens and controls exist, let alone which are covered. `docs/UI-INVENTORY.md` is the fix and is not built.
- **The ledger was wrong about Astrotalk.** Memory recorded agent `887643060282855424` live on `+91 96422 01123`; that number is now `MIGRATED` and unbound, and an "Astrotalk 85916" sits on `+91 85916 89475`. Corrected here 2026-09-21. Assume other recorded Meta-side state has drifted too.
- **No disk alerting.** `logrotate` landed 2026-09-06 after a third disk-full, but nothing warns before the next one. `/tmp` and `/var/www` hold ~500M of manual-deploy residue. → `wiki/bugs-violations/disk-full-app-log-2026-09-06.md`

## In flight

Eight branches, 37 commits, none merged. Every one of these is work that exists
and is doing nobody any good.

- `feature/draft-on-delete` — 11 commits. Backend only, no UI. PM's "preserved draft" marker overridden and still open. → `project_draft_on_delete_2026_09_16`
- `iris/phase-1-agent-creation-tools` — 8 commits
- `astrotalk-agent-build` — 7 commits
- `feature/connector-action-backfill` — 7 commits
- `fix/connector-published-badge` — 2 commits
- `fix/outbound-echo-components` — 2 commits. **Fixes a top-ranked Broken entry.**
- `feature/image-header-preview` — 1 commit
- `fix/subnav-reachable-when-collapsed` — 1 commit. **Fixes a top-ranked Broken entry.**
- `harness/rework` — 9 commits. This system. Clean on master, mergeable.
- `harness/rework-on-draft` — the same 9 commits sitting on top of `feature/draft-on-delete`, kept only because the working tree has 41 uncommitted files that overlap that branch. Delete it once those are resolved.

Run `node scripts/orient.js` for live counts rather than trusting this list.

**41 uncommitted files sit in the working tree**, 14 of them overlapping
`feature/draft-on-delete`. Until they are committed or discarded, the checkout
cannot move between those branches safely.

## Constraints

Bounds on any task. These are not preferences.

- **Production data is sacrosanct.** No destructive SQL, no unbacked migration, no config overwrite, ever, under any framing. Full rules in `CLAUDE.md`.
- **Every deploy is reversible in under 5 minutes without touching data.**
- **`+91 90100 11634` (`674661285722401`) is the reserved test number.** Free, CONNECTED, GREEN, on WABA `494227720434920`. Mutating e2e runs bind here and nowhere else. Do not give it to a customer or bind another agent to it.
- **Every other number on the demo account is somebody's agent.** `+91 91520 04492` (smsa, paused), `+91 91520 04283`, `+91 91520 04195` (IndiaMART), `+91 85916 89475` (Astrotalk 85916), `+91 90100 82954` (Test-Internal, draft). Never touched by a test.
- **`+1 555-061-1133`** on WABA `100730486010852` is a Meta sandbox number. It only reaches pre-verified recipients, so it cannot prove a real customer journey.
- **There is no local environment.** A green unit test says nothing about what a user sees. Only a Playwright run against the real app is evidence.
- **Diff cap is 400 lines**, enforced by `scripts/commit-gate.js`. Not advisory.
- **No `data-testid` anywhere in this repo.** E2E selects by role. Keep it that way.
- **The founder is deciding, not studying.** Lead with the answer; essays go in files.
