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
- **Backend runs `feature/connector-action-backfill`, not `master`.** Jar built 2026-09-21 04:49, carries migrations through **V58**; master stops at V57, and only that branch has V58. All four of V55–V58 md5-match the branch exactly. The branch is 7 commits, unmerged. **`master` does not mirror production.**
- **Connector backfill Phase B is DONE**, not pending. Both flags were set true at 04:53 on 2026-09-21 and the sweep ran at 05:00:04: "Back-filled 1 of 1 Meta tools", "Connector gone from Meta" exactly twice and never repeated, zero partial imports, zero floor-guard fires, zero failures — matching the checklist's predictions line for line. The two marked-gone connectors are the IndiaMART pair named in `wiki/deployment/connector-sync-2026-09-21-rollback-capture.md`; their pre-state is recorded there and restoring them needs founder sign-off.
- **`/opt/metaagent/src` is a fossil** — newest file 2026-09-09, twelve days older than the running jar. The jar was not built from it. Do not diff against it; read the jar.
- Frontend: traceable to a commit since 2026-09-03; **exact deployed SHA still not recorded** — record it on the next deploy.
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
- **11 of 53 backend test files mock `MetaApiClient`**, so they assert that our code calls our mock. All of them were green through the 2026-08-25..09-01 outage when no customer could create an agent, because Meta's `agent_config/settings` had silently stopped creating the entity. `node scripts/meta-check.js` covers the read paths against real Meta; the write paths are still mock-only.
- **Nothing that writes is tested.** The e2e suite is read-only by default, so every button that *does* something — publish, deploy, send, delete — is unverified. A reserved test number now exists (see Constraints); the mutating journeys do not.
- **Skill detach has no UI.** Backend `SkillLibraryService.detachSkill` exists uncommitted (+65 lines) and the founder confirmed 2026-09-21 it is wanted. Until it ships, a library skill attached to three agents can only be removed from all three. Meta has no "detach" concept — skills belong to one agent there; the library is ours, so detach calls Meta's `DELETE /{skill_id}` scoped to that agent and keeps the library row.
- **No UI inventory.** Nobody can say which screens and controls exist, let alone which are covered. `docs/UI-INVENTORY.md` is the fix and is not built.
- **The ledger was wrong about Astrotalk.** Memory recorded agent `887643060282855424` live on `+91 96422 01123`; that number is now `MIGRATED` and unbound, and an "Astrotalk 85916" sits on `+91 85916 89475`. Corrected here 2026-09-21. Assume other recorded Meta-side state has drifted too.
- **One RabbitMQ line is flooding the log** — "Failed to check/redeclare auto-delete queue(s)", 18,944 of 19,066 errors in a single day, roughly 1,400/hour. Harmless to users, and it is why the disk keeps filling.
- **Meta is rate-limiting us.** 429s ongoing since the backfill sweep went live: 89 in the 10:00 hour on 2026-09-21, still 3 at 13:00. The sweep raised per-agent GETs from ~4 to ~5. Nothing has failed yet; nothing is watching it either.
- ~~The delete path is unproven.~~ **Proven 2026-09-21.** The founder deleted a marked-gone connector through the UI; production shows zero `SQLIntegrityConstraintViolationException`, zero real MySQL `1451` and zero `fk_connector_deployment_connector` (the ten `1451` greps are thread ids like `Consumer@1451b4d3`). The RESTRICT flush ordering in `ConnectorLibraryService.delete()` holds. Still no automated cover — Testcontainers is dead on Docker 25+ — so a regression here would be silent.
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
