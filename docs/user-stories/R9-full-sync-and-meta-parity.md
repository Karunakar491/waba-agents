# R9 — Full Meta parity for Business Events, and account-wide sync

**Raised:** 2026-09-29, 05:53 IST — [founder's words](../FOUNDER-REQUIREMENTS.md)
**Status:** He read stages 2-4 and said proceed, 2026-09-29. Slices 1-4 are
live in production (all nine categories, three triggers). Slice 5 (a screen
for any of this) is designed, not built. → `docs/jobs/r9-full-sync.md`

## Where this stands

**Live:** every category — skills, FAQs, files, websites, connectors,
business persona, settings, eval case configs, insight numbers — syncs on
phone-add, login and a daily 03:00 job, Meta always winning on disagreement.
Verified against the real, active Astrotalk agent, zero failures.

**Pending — designed with the founder 2026-09-29, not built:**

- A collapsed "Synced with Meta" status line on the agent's own page,
  expanding to all 9 categories with their own last-synced time and a
  plain-language reason for any failure.
- A third Reports tab, "Insights" — account-wide, per-agent queue depth
  and per-tool health, read from what's already synced (no live Meta call
  on page load).
- `ai_handoffs` (live queue depth) promoted onto the agent's own page too —
  higher priority than the full Insights tab, since STATE.md's top open
  issue is "no notion of a queue" and this is Meta's own live count of
  exactly that.
- Eval cases get a "N cases configured" line folded into the existing Eval
  tab, not a new screen.

**Known gap, not chased:** past business-event history has no Meta
"list all" endpoint (only single-id polling), so it can't be synced the way
the other categories are — same limitation eval *run results* hit.

---

## Stage 2 — The story

Rakesh's team doesn't only work through our screens. Meta gives every business
its own place to manage a WhatsApp agent directly — and Rakesh, or whoever he's
handed access to, can and does go there. He told us this outright: *"they can
directly change also."*

Today our product doesn't know that happened. We built every screen — skills,
persona, connectors, phone numbers, and now business events — on one
assumption: things start in our UI, get saved to our database, then pushed to
Meta. Nothing reads backward. If Rakesh's colleague changes something on
Meta's side directly, our screen keeps showing the old version, confidently,
with nothing telling him it's stale.

For business events specifically this is worse than cosmetic: the whole
feature is Rakesh's systems and Meta telling us things happened, so he can stop
being the one who finds out last. If our own account can drift out of sync
with Meta and neither of us notices, we've rebuilt the exact problem — someone
finding out last — one level up.

What he wants: the moment he opens his account, everything for every agent
gets checked against Meta and brought up to date automatically, logged, and
shown to him — not a button he has to remember to press, not a per-agent
setting he has to open. And business events itself should use whatever Meta
actually offers, not a subset we picked first.

---

## Stage 3 — Probing questions

**Q1. When Meta and our database disagree on the same thing — say, the
guardrail text on a business event, or a skill's wording — which one does the
customer-facing agent actually use?**

This isn't a technical merge-strategy question — it's about what the business
owner can trust. If we silently pick one side, and it's the wrong one, the
agent starts saying something Rakesh didn't intend and he has no way to know
until a customer reacts badly. Do you want:
- Meta always wins (Meta is closer to what's actually live and being sent), or
- ours always wins (we push our version back over whatever changed on Meta), or
- neither wins automatically — we show both and make him pick, per thing that
  disagrees?

**Q2. Does "sync on open" mean only when he happens to log in, or does it also
run in the background even while he's away — so an agent doesn't drift for
days between logins?**

This changes what a customer experiences: if sync only runs at login and
Rakesh doesn't open the account for three days, the agent could be running on
stale settings — or worse, an event trigger someone deleted from Meta directly
— for those three days with nobody watching.

**Q3. "Fully functional, supports all Meta features" — for business events,
Meta's `agent_event` API has a fixed set of capabilities (event type,
description, an opaque payload, delivery status). There's no hidden feature
of Meta's we'd be leaving out by building to that spec. Is the ask that we
build everything that API offers (which R8 already scopes), or is there a
specific Meta capability you've seen elsewhere — in Meta's own business
manager, a doc, a competitor — that you want and don't see in what's planned?**

This one I can't resolve myself because I don't know what you've seen that
made you say "all the Meta features" — if you can point at it, I can tell you
in one line whether it's in scope already or genuinely missing.

**Q4. Scope of "all agents" — every data type on every agent (skills, persona,
connectors, phone numbers, FAQ, business events), or specifically the things
that feed business-event triggers (connector status, phone/conversation
state)?**

The first is a rebuild of how every screen in the product gets its data. The
second is scoped to what R8 needs to work correctly. Both are legitimate — I
want to build the one you actually meant, since they're very different sizes.

**Resolved 2026-09-29:**

- **Q1 — Meta always wins.** On any disagreement between Meta and our
  database, Meta's value overwrites ours, not the reverse.
- **Q2 — Both.** Sync on login, plus a daily scheduled sync so an agent
  doesn't drift between logins even if nobody opens the account.
- **Q3 — Deferred to research, not a question he could answer from memory.**
  He asked me to go find and report exactly where we digress from what
  Meta's own docs offer for business events, rather than guess. Findings go
  below once done, then this becomes a real acceptance-criteria item.
- **Q4 — Everything.** Not just business-event inputs — skills, persona,
  connectors, phone numbers, FAQ, settings, evals, "everything possible."
  Confirmed as the big version: every data type on every agent, two-way,
  Meta authoritative.

**Q5 — added by direct instruction, 2026-09-29, 06:45 IST, not a question I
asked:**

> If a phone number is added, it is your responsiblity to fetch Agents deployed
> on that from Meta,
>
> Chekc its skills, connectors, FAQs, knowledge bases, Events, Evals, Insights,
> Settings, Business persona's etc etc whatever possible from Meta. From Meta
> only
>
> Then sync all these to our DB.
>
> Every detail from Meta has to be fetched.

This adds a **third sync trigger** to Q2's two (login, daily scheduler): the
moment a phone number is added to an account, before anything else happens on
it. And it makes the "everything" in Q4 concrete instead of open-ended — the
named categories map exactly onto `docs/META-CAPABILITIES.md`'s own sections,
so that file is the checklist, not a paraphrase of one:

| He named | Maps to | Meta's own API |
|---|---|---|
| Skills | §2 | `agent_config/skills`, `agent-ui-skills` |
| Connectors | §5 | `agent_connectors`, `agent_connectors/{id}/tools` |
| FAQs | §2 | `agent_config/faq` |
| Knowledge bases | §2 | `agent_config/files`, `agent_config/websites` |
| Events | §6 | `agent_event` (fire/poll), business-event library is ours, not Meta's — see note below |
| Evals | §7 | `agent-eval` (`/cases`, `/summary`, past run results) |
| Insights | §7 | `insights/conversations`, `/conversations/turns`, `/tool_calls`, `/agent_events` |
| Settings | §3/§4 | `agent_config/settings` (on/off, audience, allowlist, never-say, followup, handoff) |
| Business persona | §2 | `agent_config/business_info` |
| (implied) eligibility/onboarding | §1 | `agent_eligibility`, `agent_onboarding` — provisioning facts, not editable state, but still worth reading back so a phone number's true Meta-side status is never assumed |

**"From Meta only" reaffirms Q1** — every one of these categories, once synced,
takes its value from what Meta returns, not from whatever we already had
stored.

**One real distinction worth surfacing rather than quietly resolving myself:**
"Events" has two different meanings and it matters which one he means to
sync:
- **Meta's own event *history*** — past fired events and their status, via
  `insights/agent_events` and individual `agent_event` polls. This is exactly
  the kind of thing R9 is for: pure read, Meta is the only source, sync it.
- **The Business Event *library*** — the reusable "Payment Received" /
  "Order Shipped" definitions a user creates on our screen. **Meta has no
  API for these at all** — they are our own invention, sitting entirely in
  our database, only ever turned into a raw `agent_event` call at fire time.
  There is nothing on Meta's side to sync them *from*. "Meta always wins"
  cannot apply to something Meta doesn't store.

### Open

None. Stage 4 follows below.

---

## Q3 research — where we digress from Meta's own business-events surface

Re-fetched Meta's live `agent_event` page directly (not our cached notes) and
compared field-by-field. Two real gaps, one already-tracked:

1. **Corrected after a closer look — a plain-language mapper exists
   ([`frontend/src/components/events/eventOutcome.ts`](../../frontend/src/components/events/eventOutcome.ts),
   shipped 2026-09-28), but it doesn't recognise any of Meta's seven
   official `error_message` codes.** Meta's status-poll response documents
   exactly seven values: `agent_not_enabled`, `agent_temporarily_unavailable`,
   `billing_not_configured`, `consumer_not_in_agent_audience`,
   `event_content_rejected`, `internal_server_error`,
   `thread_not_owned_by_agent`. `eventOutcome.ts`'s rules match human-readable
   phrases like "no conversation" or "rate limit" — none of which are
   substrings of the actual snake_case codes Meta sends. So today every one
   of those seven falls through to the honest fallback ("we don't have a
   plain-English explanation... WhatsApp said: X") — safe, per acceptance
   criterion #21, but #20's "a sentence in plain language" is unmet for all
   seven, not because nothing was built, but because what was built was
   aimed at different input than Meta actually sends.
2. **Already tracked, confirmed still true — `insights/agent_events`.** Meta
   runs its own daily rollup of event volume, completion and latency per
   event type, entirely independent of our ledger. We've never called it
   (`docs/meta-api/agent-event-insights.md`, `META-CAPABILITIES.md` §6/§7).
   R8 deliberately deferred this ("Meta's own event statistics on Reports.
   Ships after this, once our own record exists to check them against").
3. **The broader answer to "what are we digressing from Meta doc" already
   exists as a maintained file: [`docs/META-CAPABILITIES.md`](../META-CAPABILITIES.md).**
   It covers every WhatsApp Business Agent capability Meta offers, not just
   business events — connectors, testing, evals, conversation/tool-call/
   latency insights — row by row, each one saying whether the gap is "Meta
   can't" or "we haven't." Three rows there matter directly for R9's
   account-wide sync: `insights/conversations` (queue depth), `insights/
   conversations/turns` (per-turn latency), and `insights/tool_calls`
   (per-tool health) are all real Meta data we could be pulling in and
   aren't — none of that is data we author, so all of it is a pure read,
   the simplest possible case of what R9 is asking for.

No new field, endpoint or version drift was found on the `agent_event` page
itself vs. our captured doc — the digression is entirely in (1) and (2)
above, not in the wire contract.

---

## Stage 4 — Acceptance criteria

Business terms only. Each line is something he can check on a screen.

### When it runs

1. The moment a phone number is added to an account, every agent Meta has on
   that number is fetched and written to our database before the person is
   shown that number as "added."
2. Every agent already in the product is re-checked against Meta the moment
   its owner opens the account.
3. Every agent is re-checked against Meta once a day on its own, whether or
   not anyone logs in.
4. He can see, per agent, when it was last checked against Meta and whether
   that check found anything different.

### What gets fetched

5. For every agent: its skills, connectors (and their actions), FAQs,
   uploaded files and crawled websites, business persona, settings (on/off,
   audience, allowlist, forbidden phrases, follow-up message, handoff
   message), past business-event activity, past eval runs, and Meta's own
   insight numbers (conversation counts, tool-call health, event throughput) —
   everything in the table above that Meta actually stores.
6. The Business Event *library* (the named, reusable definitions a user
   creates on our screen) is not part of this fetch — Meta has nothing to
   fetch it from. It stays exactly as CRUD already works.

### Whose value wins

7. Wherever Meta and our database disagree on the same fact, what the screen
   shows after a sync is Meta's value, never ours.
8. Every sync is logged: what was checked, what changed, what Meta's value
   was before the overwrite, when.

### What he sees

9. He can tell, per agent, when it was last synced and whether the last sync
   found any drift — not just that a sync "ran."
10. A sync that fails partway (Meta down, one endpoint erroring) says exactly
    which categories succeeded and which didn't — never a single pass/fail
    for the whole agent.

## Out of scope

- **Writing back changes we don't yet support editing.** If Meta returns a
  value for something we have no editor for (e.g. `agent_budget`, per
  `META-CAPABILITIES.md`), we store what Meta said; we do not invent a screen
  for it as part of this requirement.
- **The Business Event library**, as above — nothing to sync it from.
- **Real-time push.** This is sync-on-trigger (add / login / daily), not a
  live subscription to every change the instant it happens on Meta's side.
- **Historical backfill of insights predating this feature.** We start
  recording from when a sync first runs for that agent; we do not attempt to
  reconstruct what Meta's insights endpoints would have said last month.

## Test cases

Run against the real app and real Meta. No mocks. Writing only to
**+91 90100 11634**.

1. Add a phone number with an existing Meta agent already configured (skills,
   FAQs, a connector) — confirm every category above appears in our database
   and on screen, matching Meta exactly.
2. Change a skill's text directly in Meta's own interface, then log in — the
   screen shows Meta's version, not the one we had.
3. Let a day pass with nobody logging in — confirm the daily sync ran and
   picked up a change made on Meta's side during that day.
4. Disconnect from Meta partway through a sync (simulate one endpoint
   failing) — confirm the agent shows exactly which categories synced and
   which didn't, not a blanket failure.
5. Add a phone number with no Meta agent on it yet — confirm this is not
   treated as an error; there is simply nothing to fetch.
6. Delete something on Meta's side directly (e.g. a skill) — confirm it
   disappears from our screen after the next sync, rather than lingering.

## Edge cases to be tested

- Two agents on the same account synced at the same moment — no interleaved
  writes.
- A sync running while someone is actively editing the same agent in our UI —
  whose change survives must not be a race.
- Meta rate-limiting us mid-sync across many agents at once (a login sync for
  an account with dozens of agents fires dozens of calls at once).
- A phone number added, then removed, before its first sync finishes.
- An agent whose Meta-side data is large enough to hit a pagination limit on
  one of the endpoints (skills, FAQs, files).
