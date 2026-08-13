---
title: Draft Agents Deleted for demo@karix.online — 2026-08-13
tags: [deploy, cleanup, agents, demo-account]
date: 2026-08-13
---

# Draft Agents Deleted for demo@karix.online

## What happened
Founder asked to delete all draft agents on the `demo@karix.online` account. Done entirely through the app's own API — logged in as that account via `POST /api/v1/auth/login` on the production server, listed agents via `GET /api/v1/agents`, filtered to `status: "draft"`, deleted each via `DELETE /api/v1/agents/{id}`. No direct DB access at any point, per org rule.

## Agents deleted (8, all status=draft, none had a `metaAgentId` — never published to Meta, so nothing to tear down there)
- 867672577944850432 — My Bakery Agent
- 867688025319018496 — E2E Test Agent
- 867688392068960256 — E2E Baker Agent
- 867695996874788864 — test
- 867710884124823552 — test
- 867716314687344640 — Shafique' ka khana khazana
- 872431649147588608 — Real Estate RFF
- 875645658537660416 — Karix Support Agent 2

Each delete call returned `{"metaFullyCleaned":true,"steps":[{"name":"Meta teardown","status":"SKIPPED", ...}]}` — consistent with [[../bugs-violations/agent-delete-cascade-missing-tables-2026-08-13|the delete-cascade fix]] from earlier this session; the endpoint correctly recognized these had no Meta footprint at all.

## Verification
- Re-fetched `GET /api/v1/agents` for the account afterward: 0 rows with `status=draft`.
- Untouched: the account's real agents (paused/active, all with a real `phoneNumberId`/`wabaId`/`metaAgentId`) — only drafts were targeted.

## Related
- [[../bugs-violations/agent-delete-cascade-missing-tables-2026-08-13|Agent Delete Cascade Missing 3 Tables]]
- [[../bugs-violations/hard-delete-migration-never-touches-meta-2026-08-13|Hard-Delete Migration Never Touches Meta]] — the sibling incident this cleanup deliberately avoided repeating (used the real API, not a raw delete)
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
