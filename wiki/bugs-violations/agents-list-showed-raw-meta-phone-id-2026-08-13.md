---
title: Agents List Showed Meta's Raw Internal Phone ID Instead of the Real Number — 2026-08-13
tags: [bug, agents, phone-number, fixed]
date: 2026-08-13
---

# Agents List Showed Meta's Raw Internal Phone ID Instead of the Real Number

## What was wrong
`AgentsPage.tsx` (and the Agent Detail header/Settings tab) rendered `agent.phoneNumberId` directly — Meta's internal numeric phone ID, not a real dialable number. `AgentController.listAgents`/`getAgent` serialized the `Agent` JPA entity straight through, which has no human-readable phone field at all; the entity only ever stores `phoneNumberId`.

The real number already exists in this app: `PhoneNumberSnapshot.displayPhoneNumber`, populated by the existing login-triggered sync (`PhoneNumberSyncService`). It was just never joined into the Agents response.

## The fix
- New `AgentListItem` DTO (`@JsonUnwrapped Agent agent, String displayPhoneNumber`) — additive to the JSON shape, no existing field renamed or removed.
- `AgentController.listAgents` now batch-loads `PhoneNumberSnapshot` for the account and attaches `displayPhoneNumber` per agent; `getAgent` does the same single-row lookup.
- Frontend (`AgentsPage.tsx`, `AgentDetailPage.tsx`): three display spots (list table's Phone/WABA column, detail header badge, Settings tab's "Connected:" line) now show `displayPhoneNumber ?? phoneNumberId ?? fallback` — falls back to the raw Meta id rather than blanking the field if a number predates the snapshot sync or hasn't synced yet, so a connected number never reads as unconnected.

## Verification
- `mvn -q -o compile` (backend) — clean, no output.
- `npx tsc --noEmit` (frontend) — exit 0.

## Related
- Confirmed while answering: which number is the IndiaMART Buyer Discovery Agent on — [[../decisions/indiamart-buyer-discovery-agent-2026-08-13|+91 91520 04195, WABA 494227720434920]], already documented from the original build, answered from the wiki record rather than a live DB/API lookup.
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
