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

Real app, real deployed production (`app.karix.online`), on the reserved
test agent `890850880113348608` ("ZZ R4R6 Proof", `+91 90100 11634`). Live
2026-09-28 11:04 UTC — jar rollback `/opt/metaagent/rollback-preLibB-20260928T105723Z-platform.jar`,
frontend rollback `/var/www/metaagent.bak-20260928T110426Z`.

### What was actually driven end to end, with evidence

- **V65 migration applies cleanly against production.** Confirmed via
  `flyway_schema_history`: `65 | business event library | 1`. Read-only
  `flyway:validate` run before the restart that applied it — clean except the
  expected "resolved, not yet applied: 65" pending notice.
- **Create, from the nav.** `POST /business-events` against the live API
  (before the frontend was even deployed) returned a real row; then created
  again through the actual UI at `/library/events`. Screenshot:
  `frontend/e2e-shots/r8-libB-nav.png`.
- **List, same data both places.** Nav page shows "Payment Received... A
  person sends it... No agents" (usedByCount=0 at that point). Screenshot
  confirms the shared `LibraryTable` renders it with the Skills/Persona
  chrome, not a bespoke layout.
- **Attach, from the agent page.** Opened agent Settings → Business Events →
  Add event → picked "Payment Received" from the picker. Screenshot
  `frontend/e2e-shots/r8-libB-agent-attached.png` shows the real result: the
  event listed under the agent with status "A person sends it", "Used by —",
  "Last updated —" (semantically last-fired, see gap below).
- **Delete warns by name, before it happens.** Clicked delete on "Payment
  Received" from the nav while it was attached to one agent. Real modal text,
  captured verbatim: *"Payment Received is used by 1 agent: ZZ R4R6 Proof.
  They will no longer be able to announce this. This cannot be undone."*
  Matches R8 acceptance criteria #5 exactly. Did not confirm the delete —
  the event and its attachment are still live as of this writing.

### Not tested

- **Two agents, "used by 2".** Only ever attached to one agent this session —
  the exact count-of-2 case (criteria #2) was not driven, only inferred from
  the count query's own logic (`GROUP BY business_event_id`, no reason it
  would misbehave at n=2 having worked at n=1, but that is an inference, not
  a test).
- **The wizard step.** Not built this pass — explicitly flagged as a stretch
  goal that didn't land. Criteria #22–26 remain untested and unbuilt.
- **Automatic triggers (#6–9).** Not built. The two options render disabled
  with a reason in the editor (screenshot shows this), but nothing behind
  them exists.
- **Fired-through-the-library.** The Trigger Event control still takes
  free-text type/description; it does not yet read from an agent's attached
  events. This means `lastFiredAt` (criteria #3's "last fired" column) will
  stay null in production indefinitely until that wiring exists — the column
  is real and correctly wired to the ledger, it just has nothing to show yet.

### Known defect, not yet fixed

The agent-page table's rightmost column header reads **"Last updated"**,
not "last fired" — `LibraryTable`'s `showUpdated` label is hardcoded, not a
prop. The *value* in that column is `lastFiredAt` (correct data), only the
*heading text* is wrong. Low severity, but a real mismatch between what the
column says and what it means.
