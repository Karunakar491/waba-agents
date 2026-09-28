# Job — Business Events, Release B: the screen a business owner actually uses

**Requirement:** R8 · [user story](../user-stories/R8-business-events.md)
**Branch:** `feature/r8-business-events`

## Job

Rakesh opens the nav, sees "Business Events" next to Skills and Connectors,
and creates "Payment Received" once — with a description and optional
guardrails. He attaches it to his agent, and from then on the same event is
reusable: the nav shows it's used by 2 agents, the agent's own page shows
when it last fired, and deleting it warns him which agents would lose it.

## Who opens this

Rakesh, and the two staff who help him answer WhatsApp. Today the only way to
tell an agent to announce something is a raw "Trigger event" button buried in
Settings, built for developers, not for a business owner who wants a named,
reusable thing.

## What they decide

Whether "Payment Received" fires as themselves clicking a button, or (later,
not this release) automatically. Which agents carry it. Whether to delete an
event that agents still use, once warned who loses it.

## What they see

One shared editor and one shared list, reachable from three places — the nav,
inside an agent, and the creation wizard — same fields, same order, same
wording, per the founder's Q9 answer ("Same like how we are doing for skills
and business persona").

## Scope of Release B

Mirrors the Skill / AgentSkillAttachment pattern exactly, since that's what
was asked for:

- `V65__business_event_library.sql` — `business_event` (the library row) and
  `business_event_binding` (agent ↔ event join). `BusinessEventFire`'s
  `business_event_id`/`business_event_binding_id` columns already exist and
  are nullable for exactly this reason (V63's own doc comment).
- `BusinessEvent` entity + repository.
- `BusinessEventBinding` entity + repository.
- `BusinessEventLibraryService` — create/update/delete (with usage warning),
  attach/detach, list with per-agent or nav-wide usage counts.
- `BusinessEventLibraryController` — REST surface for all of the above.
- Frontend: one shared `BusinessEventEditorModal` + `BusinessEventsLibraryTable`,
  wired into a new nav page, the agent detail tab, and (stretch — may not
  land this pass) the creation wizard step.

## Deliberately deferred to a later release

- Automatic triggers (his own system, watched connector) — the trigger-method
  picker will show both as visibly disabled with a reason, not built yet.
- The Inbox "send an update" button — out of scope per the founder, R8 Q8.

## Proof

Real app, real Meta, writing only to `+91 90100 11634`. Filled in as built.
