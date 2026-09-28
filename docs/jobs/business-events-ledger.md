# Job — Business Events, Release A: stop the silent failures

**Requirement:** R8 · [user story](../user-stories/R8-business-events.md)
**Branch:** `feature/r8-business-events`

## Job

Rakesh opens his agent's page to decide whether his agent can be trusted to tell
a buyer their payment cleared. What changes the decision: every attempt is now a
row he can read, including the ones we refused and why — so "it sent" stops being
something he has to take on faith.

## Who opens this

Rakesh, who sells industrial spares. Eleven times a week a buyer who has already
paid messages "did you get my payment", and one of his two staff stops working to
look it up. His billing system knew the answer hours earlier.

## What they decide

Nothing, in this release. Release A adds no screen. It exists so that the next
four releases cannot lie to him.

## What they see

Today, one button: **Trigger event**, in the agent's Settings tab, three
hardcoded options and a box asking for a phone number. It reports success for
events Meta silently discards, because nothing is recorded anywhere.

After this release, the same button — but an update that cannot work is refused
before it reaches Meta, with the reason, and every attempt is written down.

## Scope of Release A

- `V58__business_event_fire.sql` — the ledger.
- `BusinessEventFire` entity + repository.
- `PhoneKey` — the one place a customer number is normalised.
- `BusinessEventFireService` — one entry point, seven pre-flight refusals.
- `AgentEventClient` — the only caller of `/agent_event` from here on.
- `AgentDeployService.triggerEvent` delegates to it behind a flag.
- `BusinessEventStatusPollJob` — reconciles Meta's six states.
- `GET /agents/{id}/business-events/fires` (+ detail).
- `eventOutcome.ts` — Meta's six states in plain English, wired into the
  existing modal so "Sent" stops meaning two different things.

Flags: `business-events.ledger.enabled`, `business-events.status-poll.enabled`.
Both default true; off restores today's direct proxy.

## Proven before building

Production, read-only, 2026-09-25 — 48 conversation rows:

- **All 48 store the number bare**, no `+`. Meta's send field wants E.164.
  Without normalisation every update refuses as "no conversation".
- **3 rows have no country code** (10 digits vs 12). Fallback is a last-10-digit
  match, applied only when exactly one conversation matches.
- **1 row has an empty customer number** — conversation `875827910924046336`,
  open since 2026-08-13. Pre-existing; must refuse, never crash.

## Known limit going in

`standby` webhooks have been absent since 2026-09-21, and they are the only
channel carrying our agents' own words. The history's "what we told them" column
will be empty until that is fixed. It degrades to the event name and claims
nothing.

## Proof

### Migration numbering — a collision caught before it shipped

The first draft numbered this **V58**. Production's `flyway_schema_history`, read
2026-09-25, is at **V62** — V58 is `connector_deployment_tool_import_counts`,
already applied 2026-09-21. The repo folder only showed V57 because V58–V62 live
on unmerged branches. Checked every branch:

```
feature/skills-one-screen   V62
r4r6/reunify-deploy-line    V62
fix/webhook-pipeline-unblock V61
master                      V58
```

Renumbered to **V63**, which is free on every branch and in production.

### Phone-key shape — measured, not assumed

Production, read-only, 48 conversation rows:

```
shape          n   min_len  max_len
no leading +   48  0        12
digits only    47
has non-digits  1
len 0: 1   len 10: 3   len 12: 44
```

Zero rows carry a `+`; Meta's `to` wants E.164. The 3 ten-digit rows have no
country code and are unreachable — `PhoneKey.isSendable` refuses rather than
guessing one. The empty row (`875827910924046336`, open since 2026-08-13) can
never match and refuses cleanly.

### Automated tests

```
mvn -q -DskipTests compile                                   EXIT=0

Tests run: 21  BusinessEventFireServiceTest
Tests run:  6  BusinessEventQueryServiceTest
Tests run: 10  BusinessEventStatusPollJobTest
Tests run: 10  CustomerLookupTest
Tests run:  7  FireRequestLimitsTest
Tests run:  8  MetaErrorMapperTest
Tests run:  9  PhoneKeyTest
Tests run: 71, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Frontend: `npx tsc --noEmit` exit 0; `eventOutcome.test.ts` 16 passed (Jest).

## NOT proven — do not read the above as a release

- **V63 has never run against a real MySQL.** Reviewed by eye only. Local Docker
  is unavailable and the `meta_agent` user holds privileges on `meta_agent_db`
  alone, so no scratch schema is possible. This is the exact gap that let V56
  reach production broken. **Founder decision outstanding.**
- **Nothing has been fired at real Meta.** No `meta-check.js` run, no test WABA,
  nothing written to +91 90100 11634. The `agent_event` request shape, the real
  response field names and every status transition are verified against our own
  code only — which is how agent creation stayed broken for a week.
- **No e2e.** The modal rewiring is proven by type-check and static review.
- The history's "what we told them" column will be **empty** until `standby`
  webhooks return (absent since 2026-09-21). It degrades to the event name and
  claims nothing.
