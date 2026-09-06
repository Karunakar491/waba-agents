# Product audit — every screen, 2026-09-06

## How this was checked

Logged into **production** as a real user and walked all 19 screens twice, in a
browser: once quickly, once with a four-second settle on each so nothing was
judged while it was still loading. Recorded every failed request, every console
error, and every button and link with its label and whether it was disabled.
Then read the code for controls that don't do what they say.

Both passes and the scripts are in `frontend/e2e/tools/full-audit.spec.ts` and
`audit-deep.spec.ts`, tagged `@audit` / `@audit2` and excluded from every other
suite. They assert nothing — they are evidence, not a gate.

**One correction on my own method.** The first pass reported six screens as
near-empty. That was the harness: data fetching starts after the screen mounts,
so "the network went quiet" was true before anything had loaded. Reports, WABAs
and Templates are all fine. Had I written the audit off that first pass, a third
of it would have been wrong.

---

## The five that hurt most

### 1. Nobody can reply to a customer

The Inbox has **zero input fields**. Not a disabled composer, not a
"coming soon" — there is no way to type a message anywhere on the screen.

An operator watching an agent mishandle a real customer can read the whole
conversation and do nothing about it. Everything else in this audit is polish
next to this.

### 2. Conversations never end, so every number that depends on that is wrong

Dashboard: **26 total conversations, 26 active.** Nothing has ever closed,
because nothing can close — there is no close action anywhere.

Reports then reports **"Success rate 0%"**, and defines it underneath as
"Closed without a human handoff." Since no conversation ever closes, that number
is 0% permanently and cannot ever be anything else. It reads as "this agent
fails every single conversation."

That is worse than showing nothing. A metric that is structurally always zero
teaches the user to distrust the whole Reports screen.

### 3. The Skills library shows the same skill nine times

Counted on the live account: `intent-router` appears **9 times**,
`quick-reply-pills` 6, `identity` 4, `state-and-variables` 3,
`api-error-handling` 3 — around 55 rows, many of them repeats.

They are not really duplicates. Skills live on an agent, and this page rolls up
every agent's skills, so one skill deployed to nine agents becomes nine
identical-looking rows. **The row does not say which agent it belongs to**, even
though the data is right there — the API already returns `agentName` and the
table simply doesn't render it.

So the user sees nine rows with the same name, the same status, and "1 agent"
next to each, and cannot tell which is which. Deleting the wrong one is a live
change to a real customer's agent. This is the single most likely place for
someone to do real damage by accident.

*This one is mine.* I converted this page to a table today and did not add the
agent column. It should have been the first column after the name.

### 4. Four screens in the sidebar lead nowhere

| Screen | What is actually there |
|---|---|
| **Human Handover** | One paragraph saying it isn't built, and a link to Agents. Nothing else. |
| **Profile** | Email, "Starter Plan", and the sentence "Business info editing coming soon." No editable field, no password change, no actions at all. |
| **Reports** | Real, but see #2 — half of it is a permanently-zero number. |
| **Templates / Debug (Template Studio)** | Both say "Select a WABA to…" when the account has exactly **one** WABA. |

Handover and Profile are permanent sidebar entries that cost a click to
discover are empty. A user learns "some of these do nothing" and then stops
trusting the nav.

### 5. "Disconnect" on an agent does nothing at all

`AgentDetailPage.tsx:2158` — the Disconnect button next to a connected phone
number has an **empty click handler with a `// TODO: wire disconnect phone`
comment in it**.

The user clicks it. Nothing happens. No error, no spinner, no message. There is
no way to tell whether it worked, so the reasonable assumption is that it did —
on the single most consequential object in the product, the phone number.

A control that silently does nothing is worse than one that is missing, and
worse than one that fails loudly.

---

## Screen by screen

### Agents — **works**

Loads clean, no failed requests. Table is scannable. Enable/disable, Continue
setup, the Meta agent id and delete-from-row are all live and verified today.
Delete is correctly refused on a live agent with the reason on hover.

*Friction:* nothing tells you what "Needs attention" on the Dashboard maps to
here.

### Agent creation wizard — **works, with one honest gap**

Seven steps: Basics → Business Persona → Knowledge Base → Skills → Connectors →
Evals → Test & Deploy. Step 1 correctly disables **Next Step** until a number is
chosen, and the step rail shows where you are.

*Where users get stuck:* the step rail is not clickable — you cannot jump back
to step 2 from step 6 to fix one field. On a seven-step form that is a real
cost.

*Confusing:* the number picker lists nine numbers with no indication of which
are already taken by another agent.

### Inbox — **half a product**

Reading works well: conversations are newest-first, dates carry the year, a
thread opens on its newest message, every message shows date and time, and rich
messages are described properly rather than as `[interactive]`.

*Cannot:* reply (#1), close a conversation (#2), or see the customer's name —
only their number. The name is in Meta's payload and is discarded on the way in.

*Confusing:* the Open/Closed filter implies conversations close. Nothing ever
appears under Closed.

### Skills — **usable but dangerous**

Three tabs: My Skills, **UI Skills**, Browse Templates.

The UI Skills tab **already exists**, which I got wrong earlier when I said this
needed building. It is read-only, and its own text says "Edit on the owning
agent's Skills tab" — the redirect-to-agent pattern again.

*Main problem:* the duplicate rows (#3).

*Also:* "View" versus "Edit" appears per row with no explanation of why some
skills can only be viewed. (It is because library-sourced skills aren't
editable — but the row never says so.)

### Connectors — **the strongest section**

Loads clean. Each connector opens its own page holding both what it is and what
it can do, with an empty state that says plainly that deploying an actionless
connector achieves nothing. Publish/Deploy/Delete all present.

*The one real gap:* an action saved here is a template and **nothing pushes it
to Meta on deploy yet**. A user can define an action, see it listed, and still
have an agent that cannot call it. Nothing on screen admits this.

*Friction:* Delete has no confirmation, unlike Skills, which asks.

### Knowledge Base (Files) — **works, speaks the wrong language**

Files and Websites tables load, upload works, delete confirms properly.

*Confusing:* the upload picker shows `smsa (1249896194867775)` — an agent name
followed by a raw Meta phone-number id. Same complaint as the agent id: an
internal number where a human label belongs.

*Missing:* **no FAQs at all**, which is the largest single gap in the section.

*Fixed today:* the Edit pencil that only navigated to an agent is gone.

### Business Persona — **works**

Now a table with status and a publish modal that names the number and warns that
real customers see the change immediately. Good.

*Confusing:* "Edit as new draft" on a published persona is correct behaviour but
unexplained — the user is not told why they cannot edit the live one.

### WABAs — **works**

Table with Add / View / Disconnect. Disconnect goes through a confirmation.

### Debug — **works, and is genuinely good**

The most complete screen in the product. Filters by path, method, phone number,
agent, outcome and date range, and shows real timings.

*Caveat:* it is labelled for engineers, and it is. Fine.

### Dashboard — **works**

Real counts, phone number table, agent status.

*Confusing:* "Needs attention 14" with no way to act on it and no explanation of
what qualifies. Also its agent buttons read as "smsaPaused" and
"ActiveIndiaMART Buyer Discovery Agent" to a screen reader — text mashed
together, the same problem I fixed on the Inbox rows today.

### Template Studio (Iris, Templates, Settings, Debug) — **works**

Iris composer, template list, credential mapping and API log are all real.
Settings is careful and well-written: "Nothing is sent to Meta or Karix until
you save a mapping."

*Friction:* Templates and Debug both demand you pick a WABA when only one
exists. Auto-select it.

---

## Controls that lie

| Where | Control | What it does |
|---|---|---|
| Agent detail | **Disconnect** phone | Nothing. Empty handler, TODO comment. |
| Reports | **Success rate** | Always 0% by construction. |
| Sidebar | **Human Handover** | Page explaining it isn't built. |
| Profile | (whole screen) | Three read-only facts. |
| Skills | **View** vs **Edit** | Real distinction, never explained. |
| `SettingsPage.tsx` | — | 154 lines, not routed anywhere. Dead file. |

---

## What is genuinely solid

Worth saying, because an audit that only lists faults is not an honest picture:

- **Debug** is better than most products' equivalent.
- **Connector edit** is the best-shaped screen in the product.
- **Empty states** mostly follow the rule of offering a next action rather than
  a dead "coming soon" — Handover does this even while admitting it is unbuilt.
- **Destructive actions mostly confirm**, and the agent delete modal reports
  per-step what Meta did and didn't clean up.
- **No screen threw a failed request or console error** in either pass. Nothing
  is broken-broken; the gaps are missing features and misleading labels.
- The **wizard, Inbox reading experience, and Persona publish flow** all explain
  consequences before the user commits.

---

## Suggested order

1. **A reply box in the Inbox.** Nothing else competes.
2. **The agent column on the Skills table.** One column; removes the most likely
   accidental-damage path. Small.
3. **Remove or wire "Disconnect."** Deleting the button is a two-line fix and
   strictly better than what is there now.
4. **Hide "Success rate" until conversations can close** — or relabel it
   honestly. Currently it defames the agent.
5. **Closing a conversation**, which fixes the metric and the Closed filter.
6. **FAQ collections** in Knowledge Base.
7. **Push connector actions to Meta on deploy**, so a configured connector is a
   working one.
8. Auto-select the single WABA; fold Profile and Handover into something real or
   take them out of the sidebar.

---

## Related

- `docs/jobs/library-tables.md` — the tables, and the agent column I missed
- `docs/jobs/inbox-order-and-agent-delete.md` — today's Inbox work
- `wiki/bugs-violations/disk-full-app-log-2026-09-06.md`
- Still live and unfixed on the server: a RabbitMQ reconnect loop logging
  continuously. It filled the disk once; logrotate now contains the symptom but
  the fault is untouched.
