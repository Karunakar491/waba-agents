# Connector section — redesign task list

Written 2026-09-09, after the founder: *"This one and everything like this in
connectors section, I need it like a table. See, you are confusing and are
unable to work on things. Lets do this you give the tasks you think. See you
are a designer at apple, so you have to follow the design principles and give
the tasks dude. Please work on the entire connector section again. I need
something which is similar to postman like tables."*

He is right about the cause. I have been fixing whatever was in the last
screenshot. Each fix was defensible on its own and the screen still got worse,
because there is no single rule the section obeys. This document is that rule
and the work to get there.

---

## Why this kept iterating — the actual cause

Every fix in this section was defensible and the screen still got worse. That
is not a taste problem, it is a structural one:

**The section runs three navigation systems over two objects.**

1. the sidebar tree — connector → action
2. the connector's section row — Actions / Details / Authorization / Variables / Agents
3. the action's tab row — Params / Authorization / Headers / Body / Docs / Response

Two of those address the same two objects. So every layout decision had to
answer "which nav owns this?", and each answer contradicted the last one:

- Sections inside the pane → opening an action destroyed them → *"why are other
  sections closed?"*
- Sections in the header as tabs → two tab rows, `Authorization` twice → *"why
  are there 2 tabs."*
- Sections as header pills → fine today, and still two rows of navigation
  competing for the same top strip the moment anything else needs to go there.

Restyling row 2 cannot fix row 2. It has to go.

## The layout decision: a connector has no tabs

Look at what the connector's five sections actually hold:

| Section | Contents | Verdict |
| --- | --- | --- |
| `Details` | name, description, base URL, tags | 4 fields |
| `Authorization` | auth type, credential header names, mTLS flag | ~3 fields |
| `Variables` | Meta's three macros — **identical for every connector in the product** | not per-connector at all |
| `Agents` | deployments, and one Publish button | a fact plus a button |
| `Actions` | the tools | **the actual content** |

Seven fields, one static reference list, and a deployment fact — split across
five tabs. That is navigation invented to fill a screen, and it is why the
connector view kept fighting the action view.

**So: one screen per connector, no tabs.**

```
┌ Connectors / IndiaMART Supplier Search API · Published ────────────┐
│                                                                     │
│  ┌ Field ──────────┬ Value ─────────────────────────────────────┐   │
│  │ Name            │ IndiaMART Supplier Search API              │   │
│  │ Description     │ Finds suppliers for a buyer's requirement   │   │
│  │ Base URL        │ https://script.google.com/macros/s/AKfy…    │   │
│  │ Auth            │ API key · X-Api-Key (Bearer)          [+]   │   │
│  │ Client cert     │ Not required                                │   │
│  │ Tags            │ e-commerce, suppliers                       │   │
│  └─────────────────┴─────────────────────────────────────────────┘   │
│                                                                     │
│  Actions                                          [ Add an action ] │
│  ┌ Method ┬ Name ─────────┬ Path ────────┬ Params ┬ Body ┬ Desc ─┐  │
│  │ POST   │ lookup_order  │ /orders/{id} │   2    │  3   │ …     │  │
│  └────────┴───────────────┴──────────────┴────────┴──────┴───────┘  │
│                                                                     │
│  On 1 agent · Karix Demo (+91…) · up to date       [ Publish ]      │
└─────────────────────────────────────────────────────────────────────┘
```

Everything about the connector is visible at once — which is what the founder
actually asked for when he asked why sections were closed. Nothing is closed
because there are no sections. And it is all tables, which is the other thing
he asked for.

`Variables` leaves the connector entirely: Meta's three macros are the same
everywhere, so they belong at the point of use — a reference beside the Value
cell where a macro is chosen, not a tab on every connector.

### Tabs survive in exactly one place

Inside an action, where `Params` / `Headers` / `Body` genuinely are alternative
views of one request and only one can usefully be on screen at a time.

Navigation systems: **3 → 2** (sidebar, action tabs). Two tab rows become
impossible by construction rather than by styling, and the next layout question
has one obvious owner.

### What this reverses

On 2026-09-07 the founder chose "keep the connector's sections reachable" over
stacking them. That choice was between two bad options I offered — tabs, or one
long scroll of complex panels. This is the third: the connector is small enough
that nothing needs to be reachable, because nothing is away.

`docs/jobs/connector-tables-redesign.md` carries the before/after.

### What this does to the tasks below

Stated here so this document does not end up with two plans again.

| Task | Change |
| --- | --- |
| **T2** connector Details + Authorization as tables | Becomes **one property table**, not two tabbed ones. Same work, one surface |
| **T5** Agents as a table | Shrinks to the strip at the foot of the connector screen |
| **T20** *(new)* remove the connector section nav | The header keeps only the breadcrumb. Deletes the code shipped on 2026-09-09 |
| **T21** *(new)* Variables leaves the connector | The three variables become `{{customer_phone}}`-style tokens offered in the Source cell, at the point one is chosen — not a tab on every connector |
| **T19** description column in the Actions table | Now required, not optional — it is one of the four columns the trailing row needs to create an action |
| **T22** *(new)* no `Add …` controls; every table's last row is empty and live | Replaces T4/T15 and removes `Add an action`, `Add query parameter`, `Add header`, `Add another header` |
| **T23** *(new)* rewrite every label to the copy standard | Its own task, done in one pass, so the tone cannot drift back a string at a time |
| T1, T3, T6, T7, T16–T18 | Unchanged |

T20 and T21 both **delete** things I built this week. That is the honest cost of
having designed per screenshot, and they are cheaper to delete now than to keep
styling.

## The second rule: nothing is created by a button that opens an empty form

The founder: *"Why should we have add action as a separate button, Why cant we
give a table or something where user can fill data. Why an extra step for every
single thing."*

Right, and it is the same defect eight times over. Today, to add anything you
first press a control that produces an empty thing, then fill it:

| To add | Today | Steps |
| --- | --- | --- |
| an action | `Add an action` → navigate to a blank editor → fill → `Add action` | 4 |
| a query parameter | `Add query parameter` → a blank row appears → fill | 3 |
| a header | `Add header` → blank row → fill | 3 |
| a credential header | `Add another header` → blank pair → fill | 3 |
| a body field | edit the JSON, then find the row it produced | 3 |

**Rule: the last row of every table is empty and live. Typing in it creates the
thing and grows a new empty row underneath.** No `Add …` control anywhere in
the section.

For actions that means the Actions table's trailing row takes method, name,
path and description inline — the four things Meta requires — and the action
exists as soon as they are filled. Parameters and body are added by opening it,
because those are its contents rather than its identity. Creating an action
stops being a navigation.

This also deletes the `Still needed: Name, Description (Docs tab)` message:
required fields are columns in the row you are typing in, so there is nowhere
for one to hide.

## The third rule: label like an API, not like a conversation

The founder: *"the language should be professional dude, but the entire
language of button or text is some cheap conversation style."*

Correct. The section talks to the user instead of naming things. These are all
real strings in it today:

| Today | Should be |
| --- | --- |
| "What it can do" | **Actions** |
| "This connector can't do anything yet" | **No actions** |
| "Nothing it can do yet" | **No actions** |
| "Where it runs" | **Deployments** |
| "Where it is, and how it signs in" | *(nothing — it is the property table)* |
| "Who fills this in" / "Value" | **Source** |
| "Agent fills this in" | **Agent** |
| "Fixed value" | **Fixed** |
| "Customer's WhatsApp number" | **`{{customer_phone}}`** |
| "built from its fields" | **object** / **array** |
| "set when you publish" | **At publish** |
| "From the connector's Authorization" | **Connector auth** |
| "Meta accepts no other value" | **Fixed by Meta** |
| "Still needed: Name, Description (Docs tab)" | **Required: name, description** |
| "Every action inherits:" | **Inherited** |
| "Description — the agent reads this to know what it's for" | **Description** |
| "What the agent should put here" | *(placeholder removed)* |
| "Query and path values are single values only — Meta rejects an object or a list here. Nested shapes belong in the body." | **Scalars only. Objects and arrays belong in the body.** |
| "Add an action so an agent has something to call. Until then, deploying it achieves nothing." | *(deleted — the trailing row is the affordance)* |
| "Paste an example of the JSON this endpoint expects — nested objects and lists included. Every field appears in the table below." | **Example JSON** |

### The standard

1. **Nouns, not sentences.** A label names a thing. `Deployments`, not "where it
   runs".
2. **Standard technical vocabulary, not Meta's field names.** `Base URL`, not
   `base_url`. `Auth`, `Query params`, `Path variables`, `Headers`, `Body`,
   `Bearer`, `Allowed values`, `Required` — the words any engineer already
   knows from HTTP and from Postman. Meta's identifiers are our wire format,
   not our labels; a screen full of `snake_case` reads like a database dump,
   and Meta's own names are sometimes worse than the standard ones
   (`user_auth_injection_config`).

   The exception is a **value the user must type or match exactly** — a macro,
   an enum member, a header name. Those are literal and belong in `code`.
   Macros are shown as variable tokens in the style everyone knows from
   Postman — `{{customer_phone}}`, `{{customer_id}}`, `{{conversation_status}}`
   — and mapped to `WHATSAPP_PHONE_NUMBER`, `WHATSAPP_IDENTITY_HASH` and
   `WHATSAPP_CURRENT_STATUS_ID` on the way out. The user should never have to
   type or read a Meta constant.
3. **No second person.** No "you", no "your". The screen is not talking.
4. **No explaining the obvious.** A `Description` column does not need to say
   what a description is for.
5. **Constraints stated once, flatly, where they bite.** "Scalars only" on the
   params table. Not a paragraph of reasoning.
6. **Empty states are a count, not encouragement.** `No actions`.
7. **Sentence case. No exclamation marks, no hedging, no "just", no "simply".**

### Where prose is still right

Two places, and only these: a **destructive confirmation** must say what will
be lost in a full sentence, and an **error** must say what happened and what to
do. Both are moments where the user needs a sentence rather than a label.

The rest of the section should read like a reference table, because that is
what it is.

## The rule

**Everything you can edit about a connector is a row in a table. One table
grammar, used everywhere, with no exceptions.**

```
Key | Type | Value | Description | Required | ✕
```

If a thing being edited does not fit that grammar, that is a signal the thing
is modelled wrong — not a licence to add a form.

Why a table, in Apple's terms, not just "because Postman":

- **Consistency** — one pattern learned once. Today a connector's Details is a
  stack of labelled inputs, its Authorization is a different stack, an action's
  Params is a table, its Name is a lone floating input, and its Body is a
  textarea plus a table. Five patterns for one job.
- **Recognition over recall** — a table shows every field and its current value
  at once. A form makes you scroll and remember.
- **Direct manipulation** — the value is edited where it is displayed.
- **Deference** — a table is almost entirely content. Labels, help text and
  panel chrome are the parts of a form that are not.

---

## What is wrong now, by principle

Numbered so the tasks below can point at them.

### Consistency

- **W1.** Connector `Details` is a form (Name, Description, Base URL, Tags as
  stacked labelled inputs). Should be a table.
- **W2.** Connector `Authorization` is a form (auth type select, then a
  bespoke header list with its own two-input rows and its own "Add another
  header" link). Should be the same table as everything else.
- **W3.** An action's `Name` is a single input floating above the request bar,
  belonging to no group.
- **W4.** An action's `Description` is alone on the `Docs` tab.
- **W5.** `Agents` is a `<ul>` of deployments. Everything else that lists
  things is a table.
- **W6.** Body rows have no delete control; every other table row has one.

### Clarity

- **W7.** An empty table renders as a heading, blank space, and an "Add …"
  link. Nothing to read and nothing obvious to do.
- **W8.** `Still needed: Name, Description (Docs tab)` — a message that exists
  only because two required fields are in two different places, one of them
  hidden behind a tab.
- **W9.** `Response` is a tab that is permanently disabled, because Meta makes
  the call and we cannot. A tab that can never open is chrome that never earns
  its place.
- **W10.** The `Body` tab holds two representations of the same thing — a JSON
  textarea and a Fields table — both always visible.

### Truth

- **W11.** A connector shows `Published` while having zero actions. It is
  published and can do nothing.
- **W12.** Saving an action stores a template. Nothing instantiates it as a
  Meta tool, so `Test` can never work and the agent can never call it. This is
  the largest gap in the section and no amount of layout fixes it.

---

## Tasks

Ordered the way I would actually ship them: the ones that remove a *pattern*
first, because every one of those makes the next screen cheaper.

### T1 — One table component, used by everything (blocks the rest)

Build `PropertyTable` and make it the only way this section edits anything.
Columns are the grammar above; a table declares which columns it uses. Params,
Headers, Body fields and the new Details/Authorization tables all render
through it.

Fixes W1, W2, W6. Enables T2–T5.

Not a refactor for its own sake: today the params table, the body table and the
auth header list are three implementations, which is exactly why they drifted.

### T2 — Connector Details and Authorization become tables

`Details`: Name, Description, Base URL, Tags as four rows — Field | Value |
Notes.

`Authorization`: the auth type as one row; each credential header as a row with
its name, its prefix, and where its value comes from ("typed at publish"). mTLS
as a row. Same delete control per header row.

Fixes W1, W2.

### T3 — An action's own Details

Name and Description are two rows of one table on a first `Details` tab, beside
method and path. Then delete the `Still needed` mechanism — it exists only
because those two fields live apart.

Fixes W3, W4, W8.

### T4 — *superseded by T22*

Was "empty tables show one blank row". T22 is the same idea taken all the way:
*every* table's last row is empty and live, in every state, and every `Add …`
control is deleted — including `Add an action`, which made creating an action a
navigation to a blank form.

### T5 — Agents becomes a table

Agent | Phone number | Status | Last published, with `Publish to an agent`
above it.

Fixes W5.

### T6 — Body: the table is the surface, the JSON is a way in

Fields table shown by default once fields exist. The JSON box collapses to
"Paste JSON" — progressive disclosure, and it stops asking which of two views
is the real one. Deleting a body row updates the JSON.

Fixes W10, and the rest of W6.

### T7 — Remove the Response tab until Test works

It cannot open. When T8 lands it comes back with something in it.

Fixes W9.

### T8 — Instantiate actions on Meta at publish (backend)

The real gap. A connector's actions must be created as tools under
`/{phoneNumberId}/agent_connectors/{id}/tools` when the connector is published
to an agent, and the stored Meta tool ids kept so a later save updates rather
than duplicates. Until this exists, every action in this section is a document
that no agent can call.

Fixes W12, and unblocks `Test`.

### T9 — Status tells the truth

A connector with no actions is not `Published`; it is `Published, does nothing`
— or the badge is suppressed and the row says why. Decide once, apply in the
sidebar, the breadcrumb and the library.

Fixes W11.

---

*The order for all fourteen tasks is in **The order**, below the coverage
check — the layout tasks above are only half the list.*

---

## Coverage check: can a user actually add the API they want?

The founder asked the question the task list above does not answer: *"can a
user add the API he wants in UI directly — imagine various combinations of
APIs, the most complex, to the various things Meta supports."*

Tables do not answer that. This is the audit, against
`docs/meta-api/connector-tools-capability-matrix.md` (39 shapes probed live) and
`docs/meta-api/connectors.md`.

### Buildable in the UI today, no engineering

| Shape | Notes |
| --- | --- |
| REST + JSON, `GET`/`POST`/`PUT`/`PATCH`/`DELETE` | `HEAD`/`OPTIONS` rejected by Meta |
| Path parameters — `/orders/{order_id}` | Auto-detected from the path |
| Query parameters, custom headers | `string`/`integer`/`number`/`boolean`, required or not |
| Agent-filled or fixed values, per field | |
| WhatsApp macros as a value | The customer's number, identity hash, conversation status id — the closed set of three |
| Deeply nested JSON body | Objects in objects, arrays of objects, arrays of scalars. Verified two levels live; the encoder recurses |
| Several credential headers, each with a prefix | e.g. `Authorization: Bearer …` **plus** `X-Account-Id: …` |
| OAuth2 client credentials | Token URL, client id, scopes; secret typed at publish |
| mTLS | Client certificate, client key, optional CA — PEM, typed at publish |
| XML **responses** | Nothing to configure; Meta parses them |

That covers an ordinary enterprise REST API, including the nested-order-payload
kind. It is not nothing.

### Cannot be built today — our gaps

| # | Gap | Who it blocks |
| --- | --- | --- |
| **G1** | **API key in a query parameter or a body field.** Meta's `api_key` config takes `headers`, `query_params` *and* `body_params`; `ConnectorLibraryService` builds only `headers` | Every `?api_key=…` API. The single most common auth style after bearer headers |
| **G2** | **Per-user OAuth** — `user_auth_injection_config` (`location`: body/headers/path/query, `field_name`, `prefix`). Absent from UI and backend | Anything where the end customer authenticates as themselves rather than the business: order history behind a login, bookings, account-specific data |
| **G3** | **`enum` on a parameter.** Meta accepts it — verified, undocumented | Closed sets. Without it the agent invents values for a field that has four legal ones |
| **G4** | **OAuth2 `token_request_content_type`.** Meta defaults it to `application/x-www-form-urlencoded` | Any token endpoint that wants a JSON token request |
| **G5** | **Duplicate key across query and body** is rejected by Meta with a clear message; the editor lets you build it and fail on save | Anyone who names a query param and a body field the same |
| **G6** | **Meta's rejection reason is discarded.** Every failure reaches the caller as `{"success":false,"error":"Meta API error: 400"}`; the real text sits in `api_call_log` | Everyone, on every mistake. This is why the matrix had to be probed rather than read |
| **G7** | **Nothing says which body formats Meta refuses.** The Body tab invites JSON without stating that JSON is the *only* thing Meta will send | Anyone whose API takes a form POST, SOAP or a file upload — they configure a body and find out at publish |
| **G8** | **A saved action never becomes a Meta tool.** Saving stores a template; nothing calls `/{phoneNumberId}/agent_connectors/{id}/tools` | Everyone. The agent cannot call anything configured here, and `Test` can never work |

### Cannot be built at all — Meta's wall, not ours

`content_type` is an enum with exactly one member. Verified rejected:
`application/xml`, `text/xml`, `application/soap+xml`,
`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`.

So **any API that only accepts a form-encoded POST, SOAP, or a multipart file
upload cannot be connected**, by any means, through Meta. A large share of
older enterprise and payment APIs are exactly this.

The UI must say so rather than let someone configure a body and discover it at
publish — that is G7 above, and it is the one gap on this page that is not
fixable by building more. All we can do is tell the truth early.

### Extra tasks from this audit

- **T10 — API key in query params and body params (G1).** Backend + one column
  in the Authorization table: where each credential goes.
- **T11 — Per-user OAuth (G2).** `user_auth_injection_config` as rows in the
  Authorization table; a per-action "needs the customer to be signed in" flag
  (`user_auth_required` already exists on the payload and is hard-coded false).
- **T12 — `enum` on a parameter (G3).** One more column, or a comma list in the
  Value cell when the fill mode is "one of".
- **T13 — Surface Meta's actual error (G6).** Return `responseBody` instead of
  the status code. Cheap, and it makes every other failure self-explanatory.
- **T14 — Say what Meta will not accept (G5, G7).** The Body tab states JSON
  only, and names the alternatives that are rejected. Duplicate keys refused
  inline, quoting Meta's message.

---

## Where a Description column exists today

Asked directly: is `description` a column inside the table layout? In three
places yes, and the gaps are exactly the surfaces still on the old pattern.

| Surface | Columns today | Description a column? |
| --- | --- | --- |
| Query / path parameters, Headers | `Key · Type · Value · Description · Required · ✕` | **Yes** |
| Body fields | `Field · Type · Value · Description · Required` | **Yes** |
| Sent-automatically headers | `Name · Value · Why` (read-only) | Yes, as "Why" |
| Connector `Variables` | `Variable · Resolves to` (read-only) | Yes, as "Resolves to" |
| Connector `Actions` | `Method · Name · Path · Params · Body` | **No** — the description is a muted second line under the name |
| Connector `Details` | not a table | **No** — still a form (T2) |
| Connector `Authorization` | not a table | **No** — still a form (T2) |
| `Agents` | not a table | **No** — still a list (T5) |

Every field Meta records a `description` for now has a column for it. What is
missing is on the surfaces that are not tables yet, plus the Actions table,
where an action's own description is styling rather than a column — **T19**.

## Postman row behaviours we do not have

Structure copied, interaction not. These four are the ones that bite while
actually configuring an API:

- **T15 — A permanent empty trailing row.** Now **T22**, and stronger than
  Postman's version: it applies to the Actions table too, so nothing in the
  section is created by a button that opens an empty form.
- **T16 — `✕` on row hover, not a permanent column.** The delete column eats
  width on every row to serve the rare case.
- **T17 — Bulk Edit.** Swap the table for a textarea of `key:value` lines. For
  an API with twenty query parameters our one-row-at-a-time table is painful,
  and this is the single highest-leverage borrow on the list.
- **T18 — Drag to reorder rows.** Cheap, and parameter order is how people
  read their own API.

Two more Postman details already borrowed: greyed read-only auto rows, and a
`Description` column rather than a `ⓘ` tooltip. Ours is always visible where
Postman hides it behind an icon — deliberate, because the agent reads that
sentence to decide what to send, so it is content here, not an annotation.

### The one part of Postman's layout that cannot transfer

Postman's Body tab leads with a radio row: none / form-data /
x-www-form-urlencoded / raw / binary / GraphQL. Five of those six would be dead
controls, because Meta's `content_type` accepts `application/json` alone.

So the Body tab is JSON-only by force, and the honest design is to say that
where the radio row would have been — which is G7, and now T14.

---

## The order

One list, all fourteen. There were two order tables in this document at one
point — the layout one written before the coverage check, and a revised one
after. Two orders is no order.

| # | Task | Fixes | Size | Why here |
| --- | --- | --- | --- | --- |
| 1 | **T13** surface Meta's real error | G6 | XS | Nearly free, and every other failure below stops being a `400`. Doing anything else first means debugging blind |
| 2 | **T14** say what Meta refuses | G5, G7 | S | Stops people building a form-encoded or SOAP body that can never work. Pure honesty, no new capability |
| 3 | **T10** API key in query params / body params | G1 | M | The most common auth style we cannot express. Backend + one column |
| 4 | **T1** one table component | W1, W2, W6 | M | Every layout task after it is cheap; before it, each is a new implementation |
| 5 | **T2** connector Details + Authorization as tables | W1, W2 | M | Largest surface still on the old pattern. Lands T10's new column with it |
| 6 | **T22** empty live trailing row everywhere; delete every `Add …` control | W7 | M | Replaces T4/T15. Removes one step from every single thing you add, which was the founder's complaint |
| 6a | **T23** rewrite every label to the copy standard | — | S | One pass, or the tone drifts back a string at a time |
| 6b | **T16** `✕` on hover, **T17** Bulk Edit, **T18** drag to reorder | — | M | Interaction, not structure. T17 earns its place the first time someone configures twenty parameters |
| 6c | **T19** description as a column in the Actions table | — | XS | The last place a description is styling instead of a column |
| 7 | **T3** an action's own Details tab | W3, W4, W8 | S | Removes the `Still needed` workaround rather than rewording it |
| 8 | **T6** Body: table first, JSON collapsed | W10, W6 | M | Needs T1 |
| 9 | **T7** drop the Response tab | W9 | XS | Do it in the same pass as T6; it comes back with T8 |
| 10 | **T5** Agents as a table | W5 | S | Last non-table list |
| 11 | **T9** honest connector status | W11 | S | Needs a decision from the founder more than it needs code |
| 12 | **T12** `enum` on a parameter | G3 | S | Real capability, small surface — one column or one Value mode |
| 13 | **T11** per-user OAuth | G2 | L | Opens a class of API we cannot touch today. Needs backend, a per-action flag, and a login/refresh tool concept |
| 14 | **T8** instantiate actions as Meta tools | G8, W12 | L | **Matters most, sequenced last.** Its own job, not part of a design pass |

### Reading that order honestly

T8 is bottom of the list and top of the importance ranking. Everything above it
improves a document that no agent can currently call. The reason it is not first
is that it is backend work of a different shape and size, and starting it now
would leave the section half-redesigned for as long as it takes.

If the founder would rather have one connector that genuinely works end to end
than fourteen tidy screens, **T8 and T13 alone are that** — and the rest can
wait. That is a scheduling call, not a design one.

### Not tasks, but worth knowing

- `user_auth_required` already exists on the action payload and is hard-coded
  `false`. T11 is the feature behind that field.
- `upsertCertificate` is already wired for mTLS rotation, and the deploy modal
  already takes all three PEMs. An earlier note of mine claiming mTLS had
  "nowhere to put a PEM" was wrong — checked in
  `ConnectorDeployModal.tsx:117-119`.
- `GET /reports/api-calls?outcome=FAILURE` returns HTTP 500, so the fastest way
  to find failures is unfiltered and filter client-side. Unrelated to this
  section but it is how you would investigate anything on this page.

---

## What this document cannot do

Asked directly: *"So you think the doc will make the design Apple class and
then it will be the best?"*

No. Being straight about it, because overselling this is how we end up in
another ten rounds.

**What the doc does buy.** It removes the specific failure that caused the
churn: five patterns for one job, three navigation systems for two objects,
decisions made per screenshot. Those are structural mistakes and they are
fixable in prose because they are about *what exists*, not about how it looks.
Result: coherent and professional. That is a floor, not a ceiling.

**What it cannot buy, and what actually separates good from best:**

1. **Density and rhythm.** Row height, the spacing scale, where borders are and
   where whitespace does the job instead, how a table breathes at eight rows
   and at eighty. This is most of the perceived quality of a table-heavy screen
   and none of it can be specified in a task list — it has to be looked at.
2. **Type and hierarchy.** Two or three sizes doing all the work, weight rather
   than colour for emphasis, numerals aligned. Currently this section uses
   `text-xs` almost everywhere, which is not a hierarchy, it is a shrug.
3. **Subtraction.** Apple-class is mostly what is *not* there. This document
   still adds: fourteen tasks, then four more, then two rules. The best version
   of this screen probably has fewer controls than my sketch, and I will not
   find them by writing more tasks.
4. **State.** Focus, hover, disabled, loading, error, saving, and the moment
   between typing in a trailing row and the row existing. These are where a
   competent screen and a beautiful one diverge, and they are invisible in a
   plan.
5. **The feel of the thing.** Whether editing forty parameters is pleasant.
   Only usable by trying it.

### So how do we avoid another ten rounds?

Not by a longer document. By changing what gets reviewed:

**Build one screen to final craft — the connector screen — and review that
alone.** Not fourteen tasks across eight surfaces. One screen, at real density,
with real data, in both themes, with every state. Iterate on that until it is
right, then apply the settled result to the rest of the section mechanically.

The rounds so far were expensive because each one changed a different surface,
so nothing ever converged. One surface, converged, then copied, is how the
round count drops.

**What I need from the founder is judgement on that one screen**, not on a plan.
The plan's job was to make sure the screen we build is the right screen.

## Not doing

- **Postman's enable/disable checkbox per row.** Meta has no disabled parameter
  or header. The checkbox column is `Required`, which is real.
- **Collection-level headers and body.** Meta's connector object has neither.
  Already recorded in `wiki/decisions/postman-shaped-connectors-2026-09-07.md`.
- **Scripts, Settings, Runs.** Meta's runtime makes the call.

## Related

- `docs/design/apple-principles-mapping.md` — the principles these are judged
  against
- `wiki/decisions/postman-shaped-connectors-2026-09-07.md` — what was already
  decided about copying Postman
- `docs/jobs/request-tables.md` — the previous, partial pass at this
