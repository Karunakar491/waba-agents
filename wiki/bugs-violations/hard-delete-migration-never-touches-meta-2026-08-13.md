---
title: Hard-Delete Migration Never Touches Meta — 2026-08-13
tags: [bug, migration, meta-api, data-integrity, post-mortem]
date: 2026-08-13
---

# Hard-Delete Migration Never Touches Meta

## What Happened
`V47__delete_demo_test_waba_and_related_data.sql` hard-deleted the demo WABA and its 6 agents entirely from the local database, on founder request ("delete that waba from all the tables"). It was a pure SQL migration — correct for local rows, but it never called any Meta API. Every one of those 6 agents' real WhatsApp Business Agent configuration, skills, connectors, and business persona **remained fully live on Meta's side**, with our own record of it gone.

This contradicts the newer, correct pattern built the same night — `AgentTeardownService.deleteEverywhere()` — which does the Meta-side teardown (persona reset, connector deletes, skill deletes, `delete_agent`) *before* the local cascade, specifically so a "delete" in our app means gone everywhere, not just gone from our view of it.

## How It Surfaced
Later the same session, live end-to-end testing of the agent-deploy wizard needed a free phone number on this same WABA. Every number Meta's phone list returned showed `alreadyConnected: false` from our own reconciliation-informed endpoint, but attempting to actually deploy a new agent to one failed with "already connected to another agent" — because a background reconciliation job had just re-discovered the real, still-live Meta-side agent on that number and silently recreated a local shadow row for it.

## Why This Happened
`V47` was written and reviewed as a data-cleanup task, using the exact same pattern as the earlier (correct, deliberate) `V39` soft-deactivate migration for the same WABA. But `V39` only ever flipped a `status` column — it never claimed to remove anything from Meta, so a pure-SQL migration was the right tool for it. `V47` was asked to do something structurally different (a real, full delete) using the same tool, without re-deriving whether that tool was still sufficient for the new ask.

## What Should Have Happened Instead
For each of the 6 agents under the WABA, call the real app API (`DELETE /agents/{id}`, i.e. `AgentTeardownService.deleteEverywhere`) — the same mechanism used for every other agent delete in the app — *before* falling back to a scoped SQL migration for whatever Meta-independent WABA-level rows are left over (`client`, `waba_account_access`, the `waba` row itself, which have no Meta-side equivalent to clean up).

## Rule to Remember
> "Delete this from the database" and "delete this for real" are different requests, and a data-cleanup migration is only the right tool for the first one. If any of the rows being deleted have a live counterpart on an external system (Meta, a payment processor, anything outside our own DB), the app's own delete path — the one that already knows how to tear that down — must run first, even for a bulk/admin cleanup task. A migration should only ever touch rows that are purely local.

## Related
- [[../decisions/reusable-library-over-meta-execution-2026-08-13|Reusable library over Meta execution]]
- [[../bugs-violations/agent-delete-cascade-missing-tables-2026-08-13|Agent delete cascade missing 3 tables]] — the fix that made re-running the correct teardown possible
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
