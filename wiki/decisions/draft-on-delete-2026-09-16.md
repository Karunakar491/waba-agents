---
date: 2026-09-16
type: task
tags: [delete, drafts, skill-library, kill-switch, cascade, accepted-risk]
status: active
---

# Save an agent as a draft when deleting it

## Context

Deleting an agent hard-deleted the local row and twelve child tables after the
Meta teardown. FAQs, website knowledge, settings, conversation history — all
gone, unrecoverably. A mis-click, or wanting to move an agent to a different
phone number, cost weeks of written work.

The founder's framing, arrived at over several rounds: the thing that must
survive is not the *agent* but the *work*. The agent is only a wiring of skills,
knowledge and settings onto a number.

## Decision

A checkbox on the delete dialog: **"Save this agent as a draft."** The Meta
teardown runs in full either way — the agent stops existing on Meta regardless.
Ticked, the agent survives locally as a draft with no phone number, keeping its
knowledge base, settings, conversations and messages. Restoring is the ordinary
flow: pick a number, publish. It can come back on a *different* number than it
had, which was the founder's explicit requirement.

Later phases promote its skills and connectors into the shared Libraries and
re-attach the draft, so deleting the draft later removes only the attachment
and the library entries survive. Five phases total; Phase 1 (backend) is done.

### Shipped in Phase 1a
- `DELETE /api/v1/agents/{id}?preserveAsDraft=true`
- `AgentService.convertToDraft(id, wabaIdToRestore)`
- The twelve-table cascade refactored into one `childTables(id)` manifest that
  both `deleteAgent` and `convertToDraft` iterate
- `AgentDeleteResult.DraftPreservation`, nullable
- `features.draft-on-delete.enabled`, default off, failing closed

## Rationale

**One manifest, not two lists.** `deleteAgent`'s cascade was hand-maintained
until 2026-08-13, when a delete against an agent with connector history failed
on an `agent_connector` FK because the list was never updated after that table
was added. A second hand-maintained copy for the preserve path would have
doubled the odds of a repeat. EM made the shared manifest a precondition. Adding
a child table now forces you to state both a delete and a draft policy.

**The draft keeps its WABA.** `AgentDeployService.deleteFromMeta` already nulls
`wabaId` mid-teardown. Every library is WABA-scoped, so a preserved draft
without one cannot see its own content or be rebound. The id is read before the
steps and written back after — and `convertToDraft` re-loads the agent itself,
because `deleteFromMeta` has saved its own copy by then and the captured
instance is stale.

**Uploaded files are dropped.** `addFile` streams bytes straight to Meta and
keeps only the id; teardown deletes them there. Kept rows would be filenames
pointing at nothing. The dialog will warn before the click. This is the one
lossy part of the promise.

## Alternatives rejected

- **Archive table / "Recently deleted" tab.** Collapsed once the founder pointed
  out drafts are themselves deletable — the parts have to live somewhere
  independent of any agent, which is what the Libraries already are.
- **Soft delete via the unused `Agent.Status.deleted`.** A preserved agent is a
  real draft the operator can publish, not a tombstone.
- **Isolating the manifest refactor as its own commit** (EL's first proposal).
  With one call site the abstraction defends nothing and would rightly be
  rejected; EL accepted the counter-argument and the A/B split instead.

## Accepted risk — PM was overridden

PM returned BLOCKED on user-safety grounds. The founder, as tiebreaker,
declined both items for Phase 1. Logged, not fixed:

1. **No marker on preserved drafts.** A preserved draft is indistinguishable in
   the agents list from an abandoned wizard draft, but carries a former client's
   FAQs and conversation history. PM called publishing the wrong one onto a new
   customer's number a data-mixing incident. EM independently flagged it as a
   real operational exposure, not hypothetical.
2. **No republish-time warning** that inherited conversations from the old
   number will appear in the Inbox.
3. Minor: PM wanted the checkbox label to say *content* is preserved, not the
   live connection. Unaddressed.

**Revisit in Phase 2.** If either bites, it will look like a support ticket about
"someone else's old chats" or a client's config on the wrong number.

## Verification

- 7/7 integration tests green against real MySQL via Testcontainers
- 8/8 new unit tests; the 7 pre-existing `AgentTeardownServiceTest` cases
  unchanged and still green
- Run on the app server (no local Docker). Containers isolated on a random port,
  never the production database; memory capped; `metaagent` stayed `active`;
  disk and free memory identical before and after; all containers, images and
  scratch files removed.

## Gotcha for the next person

**Testcontainers 1.20.1 cannot talk to Docker 25+.** It negotiates API 1.32;
modern daemons require ≥1.40, and the run dies with *"client version 1.32 is too
old"*. Workaround used: `api.version=1.43` in `~/.docker-java.properties`. The
real fix is bumping `testcontainers.version` — not done, and worth its own task,
because it blocks every integration test in the repo on any current daemon.

Also worth knowing, learned from fixtures: `agent_skill_attachment.skill_id` and
`skill.waba_id` are genuine FKs, and `AgentAccessService` resolves a bound
agent's access through `waba_account_access`, not `Agent.accountId`. A fixture
that skips the grant gets "Agent not found".

## Commits

Branch `feature/draft-on-delete`, not merged:
- `a998b6d` — production change (6 files, 298 lines)
- `3b99938` — unit tests
- `bd3eebf` — integration tests

Split three ways because the commit gate is machine-enforced at 400 lines and
refused the combined test commit at 484.

## Still to build

Phase 1b (the checkbox itself — there is no UI yet), then skills promotion with
dedupe (`V57`, an `identity_key` on `skill`; the live library already shows
`intent-router` nine times), connector promotion, and the Knowledge library
(`V58`, the largest piece). Full plan in the session's plan file.

## Related
- [[lessons/production-safety]]
- [[lessons/verification]]
- [[bugs-violations/agent-delete-cascade-missing-tables-2026-08-13]]
