# R8 — Business Events, so the agent can speak first

**Raised:** 2026-09-25, 16:20 IST — [founder's words](../FOUNDER-REQUIREMENTS.md)
**Status:** In development — signed off 2026-09-25 ("Lets build")
**Branch:** `feature/r8-business-events` · [job](../jobs/business-events-ledger.md)

---

## Stage 2 — The story

Rakesh sells industrial spares. Two people answer WhatsApp for him, and an agent
on +91 91520 04195 answers the rest — which is most of it, a few hundred buyers a
week asking what's in stock and what it costs.

A buyer, Sajid, messages on Monday asking about a laptop charger. The agent
answers, quotes him, he pays. Rakesh's billing system sees the payment land at
14:02. His courier picks the parcel up on Tuesday and marks it shipped at 09:40.

Sajid hears none of this. He paid a stranger on WhatsApp and then silence. On
Wednesday he messages again — *"did you get my payment"* — and one of Rakesh's
two people stops what they're doing, opens the billing system, checks, comes
back and types yes. That happens eleven times a week. It is the single most
common message the business receives and it is a message about nothing.

Rakesh knows the answer already. His systems knew at 14:02 on Monday. The agent
was in the middle of that conversation and could have said so. It didn't, because
today an agent only ever speaks when spoken to.

What he wants is ordinary: when the payment clears, the agent tells that buyer
the payment cleared. When the courier marks it shipped, the agent tells him it
shipped, with the tracking number. Not a marketing blast to everyone — a sentence
to the one person in the one conversation it concerns.

There are three different people who know a thing happened, and all three need a
way to say so. His billing system knows about payments. A system he has already
connected to the agent knows about order status. And sometimes only a person
knows — the repair is finished, the item came back in stock — and that person is
one of his two staff.

He also needs to know it worked. Not "we sent 214 things". He needs to know that
of 214, thirty-three went nowhere, and why, because some of those are buyers
sitting in silence exactly like Sajid was.

### What it costs today

- Eleven "did you get my payment" messages a week, each one pulling a person off
  their work to look something up a machine already knew.
- Buyers who have paid and heard nothing. Some of them ask. The ones who don't
  are the expensive ones.
- The capability exists in the product **right now** — `agent_event` has been
  wired since before 2026-09-22 — and nobody can reach it. It sits behind a
  button reading "Trigger event" in the agent's Settings tab, with three
  hardcoded options and a box asking for a phone number.
- Worse, that button lies. It reports success for events Meta silently discards.
  Nothing is recorded, so there is no way to discover this except from a customer
  who never got told.

---

## Stage 3 — Probing questions

**Q1. Who fires the event — his system, a connector, or a person by hand?**
*Asked 2026-09-25. Answered same day:*

> Can be all3, We should make a generic feature right

All three, user-selectable per event. Resolved.

**Q2. What should the customer see — the agent's own words, his words, or the
agent's words within guardrails he sets?**
*Asked 2026-09-25. Answered same day:*

> However Meta is alllowing, everything should be there. User should be able to
> choose anything among the 3

**Resolved, with a correction he was told at the time.** Meta's `agent_event` has
no field for message wording — it takes a type, a description and an opaque
payload, and the agent always composes. So of the three, "agent writes it" and
"agent writes it within your guardrails" are native; "you write the exact words"
is not buildable on this endpoint and would be a marketing template send, a
different API under a different compliance regime. Recorded as raised; built as
the two that exist.

**Q3. Which trigger first, given an event can only reach a customer who already
messaged?**
*Asked 2026-09-25. Answered same day:*

> All three together

Resolved. Split into sequenced releases for shipping only — the scope is all
three.

**Q4. Who finds out when an event goes nowhere, and how?**
*Asked 2026-09-25. Answered same day:*

> All of these

Refuse up front what we can detect, return the reason to whoever fired it, and
keep a full visible history. Resolved.

**Q5. Do we store a customer's API key at rest so we can watch a connector?**
*Asked 2026-09-25 — flagged as a trust decision, not a technical one, because
today we deliberately hold no customer credentials. Answered same day:*

> Go ahead — we store the key

Resolved, with safeguards recorded in the plan: a separate watch-only table, the
existing `SecretEncryptor`, mandatory `OutboundTargetGuard` on every fetch, a
first run that seeds without firing, and hard caps on entities and sends per run.

**Q6. Where should it sit in the creation flow, given a brand-new agent has no
conversations and so nothing set up there can fire yet?**
*Asked 2026-09-25. Answered same day:*

> You tell me where should we have ideally

His to delegate, mine to decide. Decided: its own step after Connectors, not
buried inside Connectors — two of the three triggers have nothing to do with
connectors. It stays in the wizard because that is where an owner learns the
agent can speak first, and the copy says *"Set these up now — they'll start
working the moment a customer messages you"* rather than "do this later", which
would be an instruction to skip the thing we want found.

**Q7. Which surfaces, and does the wizard show metrics?**
*Asked 2026-09-25. Answered same day:*

> See We need to have all 3, In the agent creation, in the agent edit and the Nav
> bar
>
> But in the agent creation the evnts wont have metrics right, it will just have
> the event creation part

Resolved, and he is right: a new agent has no history, so a counts column at
creation would only ever read zero and would teach the owner the feature is dead
on the first screen he meets it.

**Q8. Is the Inbox in scope?**
*Raised by him 2026-09-25, unprompted:*

> Leave inbox for now

**Out of scope for this release.** Noted against my recommendation — the Inbox is
where the person who knows the repair is finished actually works, so it is the
natural home of the manual trigger. Recorded as his decision and revisited after
this ships.

**Q9. One create screen across all three surfaces?**
*Asked by him 2026-09-25:*

> That create page should be same across all 3 (Create agent, edit agent and Nav
> bar)
>
> Same like how we are doing for skills and busines persona

Resolved. This is R6 applied to events, and R6 covers the **listing** as well as
the form. One editor component, one listing component, one mapper, three callers.

### Open

None. Nothing here blocks stage 4.

---

## Stage 4 — Acceptance criteria

Business terms only. Each line is something he can check on a screen.

### Defining what the agent announces

1. From the nav bar, the agent's own page, or the creation wizard, he can create
   a business event by giving it a name, saying what it is for, and optionally
   writing guardrails.
2. **The create screen is the same screen in all three places.** Same fields,
   same order, same wording.
3. **The list of events is the same list in both places it appears** — the
   agent's page and the nav bar — differing in exactly one column: the agent page
   shows when it last went out, the nav bar shows how many agents use it.
4. An event created in one place is immediately visible in the others.
5. Deleting an event that agents are using warns him which agents, by name,
   before it happens.

### Choosing how it gets set off

6. Each event offers three ways to be set off, and he picks per event: his own
   system tells us, a connected system is watched, or a person sends it.
7. Where a choice cannot work yet, it is visibly unavailable **with the reason
   showing** — "connect a system first", not a dead control.
8. For "his own system tells us", the agent's page gives him an address, a key,
   and a single button that copies all of it as something he can forward to
   whoever built his systems. He never has to understand it.
9. That screen tells him whether his system has ever actually reached us, in one
   line, without him opening a log — including when something arrived and was
   rejected, and why.
10. He can replace the key, and is warned first that his system stops working
    until someone updates it.

### Sending, and refusing to send

11. Sending an update asks him to pick a customer **from conversations that
    exist**. There is nowhere to type a phone number.
12. A customer a person from his team is currently handling is shown as
    unavailable, with the reason on the row.
13. When an agent is not live, the screen says so and nothing can be sent.
14. Nothing is ever sent to Meta for an update we have already refused.
15. Before sending, he can see the guardrails that apply, and a line telling him
    the agent writes the words itself and he cannot preview them.

### Knowing what happened

16. Every update ever attempted appears in a history: which customer, what the
    agent actually said where we have it, how it was set off, when, and what
    became of it.
17. Updates we refused appear in that history too, with the reason, alongside the
    ones that went out.
18. Each event shows **two numbers, not one** — how many went out and how many
    did not — and the failures are clickable through to their reasons.
19. No screen describes an update as delivered when WhatsApp has only accepted
    it.
20. A failure explains itself in three parts, always all three: a sentence in
    plain language, a next step he can actually take, and Meta's own words
    underneath if he wants them.
21. A failure we have no plain-language explanation for says exactly that and
    shows Meta's words, rather than being hidden or guessed at.

### In the creation wizard

22. Creating an agent now includes a Business Events step, after Connectors.
23. That step can be skipped, and skipping it creates nothing.
24. That step shows no counts and no history.
25. It shows an example of what the agent would say, clearly marked as an
    example.
26. The final review screen of the wizard tells him how many things the agent
    will announce on its own, with a link back to change them.

---

## Out of scope

- **The Inbox.** His decision, Q8. No "send an update" button on a conversation
  in this release.
- **Writing the exact message.** Not buildable on this API — Q2.
- **Handing a conversation back to the agent** after a person has replied. Meta
  rejects the call; a button for it would manufacture trust in something that
  does not work.
- **Messaging customers who have never written in.** That is a marketing
  campaign, a different API and a different opt-in regime, and it already has a
  home in Template Studio.
- **Scheduled or recurring announcements** — "three days after shipping". That is
  a journey builder.
- **Retrying failures automatically.** The common failures are permanent;
  retrying them produces a history nobody trusts.
- **Meta's own event statistics on Reports.** Ships after this, once our own
  record exists to check them against.

---

## Test cases

Run against the real app and real Meta. No mocks. Writing only to
**+91 90100 11634**.

1. Create an event from the nav bar, then open the creation wizard and the
   agent's page — the same create screen appears in all three, and the event
   created in one is present in the others.
2. Attach an event to two agents; the nav bar shows "used by 2".
3. Send an update to a customer who has an open conversation. The message arrives
   on the real handset, in the agent's own words, and the history row moves from
   queued to handed-to-WhatsApp to delivered.
4. Send an update naming a customer who has never messaged the number. It is
   refused before anything reaches Meta, the reason is shown, and the refusal
   appears in the history.
5. Have a person reply in a conversation, then try to send an update to it. The
   customer shows as unavailable with the reason.
6. Fire an event from outside the product using the address and key. It arrives,
   the proof line updates, and the history shows it as set off by his system.
7. Send the same outside request twice with the same reference. One message
   reaches the customer, not two.
8. Send an outside request with the wrong key. It is rejected, and the agent's
   page says something arrived and was rejected because the key did not match.
9. Replace the key; the old one stops working and the new one works.
10. Create an agent end to end through the wizard including the new step, and
    confirm the review screen counts the events.
11. Skip the new wizard step; no event is created and the agent still deploys.
12. Turn the feature flag off; the product behaves exactly as it does today.

---

## Edge cases to be tested

- **A phone number stored without a leading `+`. PROVEN against production
  2026-09-25** — all 48 conversation rows store the number bare (`919876…`), none
  with a `+`, while Meta's send field wants E.164. Normalization is mandatory;
  without it every update would be refused as "no conversation" and the feature
  would look dead on arrival. Must be covered by a test.
- **A customer with no country code. PROVEN, 3 rows** — 10 digits where the rest
  have 12. We cannot construct a valid number for these, because the country
  cannot be inferred. Fallback is a last-10-digits match, applied **only when
  exactly one conversation matches**; two matches must refuse rather than guess,
  because guessing messages the wrong person.
- **A conversation with an empty customer number. PROVEN, 1 row** — conversation
  `875827910924046336` on agent `875651765431701504`, open since 2026-08-13 with
  a zero-length `external_id`. Pre-existing defect, not caused by this work.
  Raised separately; an update to it must refuse, never crash.
- A conversation that closed between the screen loading and the send.
- An agent paused between the screen loading and the send.
- Meta accepting an event and returning no id to track it with.
- Meta reporting the event as skipped — must read "Not sent" with Meta's reason,
  never "Sent".
- Meta returning a reason we have no plain-language mapping for.
- An event whose data exceeds Meta's size limit — refused by us, naming the
  field, before the call.
- An agent with no phone number bound.
- An event deleted while an agent still has it attached.
- A key revoked while the customer's system is mid-request.
- Two people sending the same update to the same customer at the same moment.
- A draft from the old 7-step wizard resuming into the new 8-step one.
