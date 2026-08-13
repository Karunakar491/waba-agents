---
title: MDH Agent Deployed Live — 2026-08-13
tags: [deploy, agents, mdh, meta]
date: 2026-08-13
---

# MDH Agent Deployed Live

## What happened
Founder confirmed with Meta that the MDH agent's config was verified correct end-to-end and asked to deploy it on a real number. Agent id `723456789012345678` on `demo@karix.online` — persona/description is genuinely "MDH Spices..." (an authentic Indian spice heritage brand) though the `displayName` field is still the generic leftover "E2E Test Agent" from earlier testing. Already had `phoneNumberId=1249896194867775` (**+91 91520 04492**) bound from prior work; status was `paused`, never activated.

Confirmed identity/target with founder before acting (misleading display name, wanted to avoid deploying the wrong agent to the wrong number). Deployed via the app's own API: `POST /api/v1/agents/723456789012345678/deploy`, logged in as `demo@karix.online` through the real login endpoint — no direct DB access.

## Result
- `status: paused → active`
- `deployedAt` stamped
- `metaAgentId` now populated (`pfbid0827eUTZ...`) — confirms Meta accepted the enable call, not just a local status flip.

## Follow-up worth flagging (not acted on without a separate ask)
`displayName` is still "E2E Test Agent" — cosmetic only, doesn't affect the live behavior, but worth renaming to something MDH-specific via the existing "Add a label" rename flow (item 7 from the [[../decisions/eight-critical-internal-feedback-items-2026-08-13|eight-item batch]]) so the Agents list isn't misleading for a real live agent.

## Related
- [[../bugs-violations/connector-creation-never-succeeds-2026-08-13|Connector Creation Never Succeeds]] — earlier MDH-adjacent investigation, same agent's history referenced there
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
