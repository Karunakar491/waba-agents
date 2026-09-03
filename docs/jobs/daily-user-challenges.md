# What a normal user runs into, day to day

## Job

Karunakar decides what to fix next; he sees a ranked list of what actually
breaks a working day, each item with the evidence that proves it, rather than a
list of opinions about the UI.

## Proof

Everything below was observed on **https://app.karix.online** on 2026-09-03,
signed in as `demo@karix.online`, against the account's **real WABA
`494227720434920`** and its seven real numbers. The IndiaMART agent
(`875651765431701504`, `+91 91520 04195`) was never opened, clicked or edited —
the walk scripts abort if a target string matches it.

Harness: `frontend/e2e/tools/walk.spec.ts` (every route), `walk2.spec.ts`
(inside the screens), `walk3.spec.ts` (verification + screenshots),
`shots.spec.ts` (screenshots). Reports and images in `frontend/e2e-walk/`.
Nothing was created, edited, saved, published or deleted.

Two claims I formed and then **withdrew** on checking, recorded so the list
isn't read as more damning than it is:

- "The WABA detail page is blank" — I had built the URL from the wrong id. The
  app links with Meta's WABA id and the page renders correctly; the blank state
  I hit was its accurate "WABA not found".
- "The Skills, Persona and Eval tabs render nothing" — my script measured
  before they finished loading. They render fine (see item 27 for what remains).

---

## Tier 1 — breaks the working day

### 1. You are thrown out to the login screen every 15 minutes, mid-task

The worst item on this list, and the most fixable.

- The access token lives **15 minutes** (measured from the JWT `exp`).
- The server already issues a **7-day refresh token** and already exposes
  `POST /api/v1/auth/refresh`.
- **The frontend never calls it.** `grep -rn "auth/refresh" frontend/src`
  returns nothing.
- On any 401, [api.ts:23](../../frontend/src/lib/api.ts#L23) clears the auth
  store and does `window.location.href = '/login'` — a hard navigation.

So: fill in four steps of the seven-step agent wizard, take a phone call, come
back, click Next — the page vanishes and you are at the login screen with
nothing kept. I hit this myself mid-test: one request succeeded, the next
returned `401 Unauthorized`.

The refresh machinery exists and is simply unplugged.

### 2. A customer asks for a human, and no human can ever answer

- **15 of 24** conversations carry `needsHuman: true`.
- The Inbox describes itself on screen as a **"Read-only audit log"**. There is
  no reply box.
- `/handover` says, in its own words: *"An account-wide handover dashboard isn't
  built yet."*

The product correctly detects that a customer is stuck and then does nothing
with that fact. For a support tool this is the whole job.

### 3. No conversation ever closes

All **24 of 24** conversations are `status: open`, and `closedAt` is `null` on
every single one. Consequences the user sees:

- The Open / Closed filter in the Inbox is decoration — Closed is always empty.
- The queue only ever grows. There is no notion of "done".
- The Dashboard shows **"Total conversations 24"** next to **"Active
  conversations 24"** — two cards with the same number, forever.
- `/reports` shows **"Success rate 0%"**, defined as *"closed without a human
  handoff"*. It will read 0% permanently, no matter how well the agent does.

### 4. The agent takes 11.6 seconds to say "Hello"

Measured against the live agent on the real WABA via Meta's own `agent_test`
API — no message went to a customer:

```
YOU: Hi
→ "Hello! I'm the SMSA WhatsApp assistant. How can I help you today?"
   HTTP 200, 11.63 s
```

The agent **works**. But on WhatsApp, eleven seconds of silence after "Hi" is
indistinguishable from a dead number. Customers send "?" or leave.

---

## Tier 2 — the screen tells you something untrue

### 5. Every conversation's agent ID is silently corrupted in the browser

[Conversation.java:31](../../backend/src/main/java/com/metaagent/platform/domain/conversation/entity/Conversation.java#L31):
`agentId` is a `Long` serialized as a JSON **number**. The wire value
`882515538725572608` becomes `882515538725572600` in every JavaScript client —
past `Number.MAX_SAFE_INTEGER`.

The two fields directly above it are annotated
`@JsonSerialize(using = ToStringSerializer.class)`, and one carries the comment
*"TSIDs overflow JS Number.MAX_SAFE_INTEGER"*. The hazard was known, written
down, and missed one line later. One-line fix.

Nothing in the Inbox reads `conversation.agentId` today, so no screen is broken
right now — this is a live trap for whoever wires up "jump to this agent".

### 6. Persona Library fails silently on a number the app itself offered

Opening `/library/persona` fires two requests for
`phoneNumberId=892937373893469` and both return **400**:

```
{"success":false,"error":"You don't have access to this phone number."}
```

That number is `+91 90100 82954` — a real, `CONNECTED` number on the account's
own WABA, returned by the app's own `/waba/{id}/phones`. It simply has no agent
bound (`alreadyConnected: false`), and the access check is keyed on agent
binding while the picker offers every WABA number.

The user sees **no error at all**. The panel is just empty.

### 7. Two personas both claim to be live on the same number

On `/library/persona`, an SMSA persona marked **Published** says *"Live on +91
91520 04283"* — and a "Karix Voice provides cloud calling…" persona marked
**Saved** says *"Live on +91 91520 04283"* too. Only one can be. The screen
contradicts itself, and gives no way to tell which is real.

### 8. A live agent is describing the wrong company

The agent `smsa` on `+91 91520 04492` has an About/persona that begins *"MDH
Spices is the online store of the MDH heritage Indian spice house…"*, while its
system prompt is the SMSA courier assistant. Visible right on the Agents list.

### 9. Numbers with real Meta problems look perfectly fine

`+91 96422 01123` comes back from Meta as `qualityRating: UNKNOWN`,
`nameStatus: DECLINED`, `status: MIGRATED`. The Agents list shows it as an
ordinary row with a toggle. Nothing warns that its display name was rejected or
that it has been migrated.

---

## Tier 3 — you cannot tell what is going on

### 10. Two of the seven columns on the Agents list are internal plumbing

There is an **AGENT ID** column of 18-digit database ids, and a **"Copy agent
ID"** button on every row. The Dashboard repeats the same column. These are our
primary keys — they mean nothing to the person using the product.

### 11. There is no health column

`smsa` is Paused, IndiaMART is Active, `Test-Demo` is a draft — and the list
shows the same toggle for all of them. Whether an agent is actually answering
customers is the one thing this table doesn't say. (An Agent ID column occupies
the space where it belongs.)

### 12. Most agents are named after their own phone number

Five of the eight visible rows are called `+91 85916 89475`, `+91 90100 11634`,
and so on — so the AGENT column and the PHONE column print the same string.
The live agent handling real customers on `+91 91520 04283` is *named* `+91
91520 04283`. On the Dashboard this produces rows reading *"Phone number: +91
91520 04283 · Agent status: +91 91520 04283"*.

### 13. The PHONE column shows a phone number, or a raw Meta id

Rows whose number never synced show `1082775018258373` and `1001675424082640`
where a phone number belongs. Same column, two different kinds of thing.

### 14. Every agent says "5h ago"

LAST UPDATED reflects a background reconcile job that touches all agents, so it
is identical on nearly every row and can never tell you when *you* last changed
something.

### 15. The Inbox hides the date

Threads show only a time — `01:08 pm`, `06:38 pm`. That `01:08 pm` thread is
from **27 August**. The list is sorted correctly, newest first; the display
throws away the one part that would let you see it. Every thread looks like
today.

### 16. Customers are phone numbers, even when we know their name

The Inbox lists `917899493739`. In that same conversation the agent replies
*"Hello Mohammed!"* — the name is available and isn't shown. There is no name
field on the conversation record at all.

### 17. "Needs attention (14)" is noise

Fourteen of sixteen agents are flagged, and the list is paused agents and
unfinished drafts. Nothing in it is actionable, so the panel gets ignored — and
with it anything genuinely urgent.

### 18. "Agents deployed: 6" while two agents are answering customers

The headline counts agents bound to a number. Four of the six are Paused. The
number a user wants — how many are live — isn't shown anywhere.

### 19. The breadcrumb lies

`/library/persona` renders the breadcrumb **"Dashboard"**. So do other library
pages. You cannot tell where you are from the top of the screen.

### 20. Personas have no names

Cards are titled with the opening lines of the prompt itself. Two SMSA personas
are near-identical walls of text distinguishable only by a small status chip.
One card dumps a raw prompt complete with `## Welcome Flow` and backticked tool
names. Cards run to wildly different heights.

### 21. Files are grouped by raw Meta phone-number id

`/library/files` organises by nine ids like `1249896194867775` instead of by
agent name or phone number.

### 22. A whole column of the same value

The Dashboard's WABA ID column prints `494227720434920` seven times — once per
row — because the account has one WABA.

---

## Tier 4 — half-built, and says so

### 23. `/profile` — 152 characters, ending "Business info editing coming soon."
`/settings` redirects here, so Settings is a dead end.

### 24. `/handover` — an explanation of a missing feature, and a link away.

### 25. `/templates` — nothing until you pick a WABA from a dropdown with one entry.

### 26. Connectors — all six show **"No auth"**.

### 27. Agent tabs flash empty
Skills, Business Persona and Eval finish loading more than a second after the
page has otherwise settled. They render correctly; they just show an empty panel
first, which reads as "there's nothing here".

### 28. Nine of sixteen agents are abandoned drafts
`Pipeline Test Agent`, `Test-Demo`, `TATA MOTORS`, `TATA_MOTORS_AGENT_AI`,
`TATA motors poc`, `Tata motors poc`, and a second `smsa` — all in the one list
a user works from, with no way to archive them.

### 29. `GET /api/v1/wabas` returns HTTP 500
The real route is `/waba`. A wrong path should be a 404, not a server error.

---

## Tier 5 — WhatsApp will punish us for these

### 30. The agent sent an unprompted follow-up an hour later

In a real conversation: customer's last message at 05:56 pm, then at **06:56
pm** the agent sent *"Still here whenever you're ready to continue."* Nobody
asked for it. Unprompted outbound messages damage number quality and get numbers
blocked, and this one went to a real customer.

### 31. WhatsApp formatting isn't rendered for the operator

The Inbox shows `*Track*` and `*AWB*` with literal asterisks. The customer sees
bold; the person reading the Inbox sees markup.

---

## If only five things get fixed

1. **Wire up token refresh** (item 1). The pieces exist. Being logged out every
   15 minutes taxes every other task in the product.
2. **Let a human reply in the Inbox** (item 2). 15 conversations are waiting.
3. **Close conversations** (item 3). It unblocks the Inbox filter, the Dashboard
   cards, and the success-rate metric all at once.
4. **Cut the agent's response time** (item 4). Eleven seconds reads as broken.
5. **Rebuild the Agents list around health, not identifiers** (items 10–14) —
   drop the Agent ID column, add status, and stop naming agents after their own
   phone number.

Items 5 and 6 are small, contained fixes worth taking while nearby.

## Notes

Not tested, and still untestable: whether the agent answers *correctly* over
real WhatsApp. `agent_test` proves the model responds, not that a customer's
message arrives, gets answered, and is delivered back. That needs a number we
can safely send to — a business decision, not an engineering one.
