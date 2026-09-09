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

### T4 — Empty tables show one blank row

A table with nothing in it renders its header and a single empty row, the way
Postman's does. Typing in it makes it real and grows another. Remove the
separate "Add …" links.

Fixes W7. Also removes the dead space in the screenshot that started this.

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

## Order, and why

| # | Task | Why here |
| --- | --- | --- |
| 1 | T1 one table component | Every later task is cheap after it and expensive before it |
| 2 | T2 connector Details + Authorization | The largest surface still on the old pattern |
| 3 | T4 empty tables | Small, and it is the thing in the screenshot |
| 4 | T3 action Details | Removes the `Still needed` workaround |
| 5 | T5 Agents table | Last non-table list |
| 6 | T6 Body disclosure | Needs T1 |
| 7 | T7 drop Response | Trivial, do it with T6 |
| 8 | T9 honest status | Needs a decision, not much code |
| 9 | T8 Meta instantiation | Backend, largest, and the only one that changes what the product *does* |

T8 is last by sequence and first by importance. It is the one task on this list
that a user would notice from the outside, and it should be scheduled as its
own job rather than smuggled into a design pass.

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

### Cannot be built at all — Meta's wall, not ours

`content_type` is an enum with exactly one member. Verified rejected:
`application/xml`, `text/xml`, `application/soap+xml`,
`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`.

So **any API that only accepts a form-encoded POST, SOAP, or a multipart file
upload cannot be connected**, by any means, through Meta. A large share of
older enterprise and payment APIs are exactly this.

The UI must say so rather than let someone configure a body and discover it at
publish. That is G7.

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

### Revised order

T13 first — it costs almost nothing and every other gap becomes diagnosable
instead of a `400`. Then T10, then T1–T7 (the table work), then T11, T12, T14,
then T8.

T8 still matters most: until actions are instantiated as Meta tools, all of the
above is a document that no agent can call.

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
