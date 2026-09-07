# The connector workbench — Postman's shape, Meta's shape underneath

## What the founder asked for

> "See the layout should be like postman dude. Its clean, and laptop friendly
> and all." … "Its not like we will copy postman entirely, We have to also take
> care of UI UX as per Meta API. Include both connector and connector tools."

So: Postman's **shape** — a sidebar tree, a request bar, tabs so one panel shows
at a time, a response pane, full width — organised around what Meta actually
has, and covering **both** levels.

## The one thing Postman gets wrong for us

Postman has a single idea of "a request", and puts auth on either the request or
the collection, interchangeably.

Meta does not work that way. Configuration is split across two objects, and the
split is not cosmetic:

| Meta object | Path | Holds |
|---|---|---|
| **Connector** | `/{phoneNumberId}/agent_connectors` | name, description, `base_url`, `auth_type`, `auth_config`, mTLS certificate, `user_auth_injection_config` |
| **Tool** | `/{phoneNumberId}/agent_connectors/{id}/tools` | name, description, `request_definition` (method, path, path/query/header params, body), `user_auth_required` |

**Auth is only ever connector-level.** A tool cannot carry its own credentials.
Two endpoints on the same API that need different keys are two connectors, not
two tools — and the UI has to make that obvious rather than letting someone hunt
for an auth tab on a tool that will never have one.

**A tool's `description` is read by the AI, not by a human.** It is how the agent
decides *when* to call the thing. In Postman a description is a comment; here it
is behaviour. It gets first-class placement, not a collapsed "docs" tab.

**"Who fills this in" has no Postman equivalent.** Every parameter is either
filled by the agent at conversation time, pinned to a fixed value, or bound to a
Meta macro (`WHATSAPP_PHONE_NUMBER`, `WHATSAPP_IDENTITY_HASH`,
`WHATSAPP_CURRENT_STATUS_ID`). This is the most important column on the screen
and Postman has nothing like it.

## Layout

```
┌────────────────┬──────────────────────────────────────────────────────────┐
│ CONNECTORS   + │  IndiaMART Product Search API              Published     │
│ ─────────────  │  ┌────────────────────────────────────────────────────┐  │
│ ▾ IndiaMART …  │  │ POST ▾ │ /whatsapp/mba/index.php        │ [ Test ] │  │
│     product_…  │  └────────────────────────────────────────────────────┘  │
│     supplier_… │  Params │ Headers │ Body• │ Response                     │
│ ▸ Google Sheets│  ────────────────────────────────────────────────────────│
│ ▸ Pricing API  │  name     type    who fills in      description          │
│                │  action   string  Fixed: product-…  Selects the endpoint │
│ + New connector│  query    string  Agent fills in    What the buyer asked │
└────────────────┴──────────────────────────────────────────────────────────┘
```

**Sidebar** — connectors, each expanding to its tools. This is the navigation;
the current Connectors table stays as the list/deploy view, and the workbench is
what "Edit" opens.

**Selecting a connector** shows connector-level tabs:

| Tab | Contents |
|---|---|
| Details | name, description, base URL |
| Auth | `auth_type`, then the matching `auth_config` — see below |
| Certificate | mTLS PEMs, only when "requires a client certificate" is on |
| User auth | `user_auth_injection_config` + the login/refresh tools |
| Deployments | which agents run it, and which are behind |

**Selecting a tool** shows the request bar plus tool-level tabs:

| Tab | Contents |
|---|---|
| Params | path + query parameters. Scalars only — Meta rejects object/array here |
| Headers | header parameters, each with binding |
| Body | the nested JSON editor, disabled with a reason for GET |
| Response | last test run: status, latency, content type, body |

A tab shows a dot when it holds anything, so nothing is hidden without a hint.

## What this fixes beyond the layout

**Auth gaps that currently make connectors unusable for an enterprise.** All of
these are supported by Meta and absent from our UI today:

- API-key auth exposes **one header**. Meta accepts an array of headers, an
  array of query params, and an array of body params, each with an optional
  prefix.
- The **mTLS checkbox has nowhere to put a certificate**, so ticking it produces
  a connector that cannot work. Same class of defect as the Disconnect button.
- **Per-user OAuth is entirely absent** — no injection config, no login or
  refresh tool types.
- **OAuth token request content type** is not configurable.

**Parameter gaps.**

- `enum` on a parameter is accepted by Meta, undocumented, and the only way to
  stop the agent inventing a value for a closed set.
- A key used in both `query_parameters` and `body.params` is rejected by Meta
  with a clear message; the editor lets you build it and fail on save. The Params
  tab should refuse it inline, quoting Meta's own sentence.

**The whitespace.** Every page capped itself — this one was `max-w-3xl`, 768px
on a 1440px laptop. The workbench is full width with a fixed sidebar.

**The "too many panels" problem.** The founder's earlier correction was that a
page holding several complex panels at once is harder to use, not easier. Tabs
are the answer: one panel visible, all of them one click away, nothing hidden
without a mark.

## Deliberately not Postman

- **No environments or variables.** The equivalent already exists and is
  narrower: agent-filled, fixed, or one of three macros. Inventing a variable
  system on top would be a second way to say the same thing.
- **No scripting tabs.** Pre-request scripts have no analogue in Meta's runtime.
- **No arbitrary content types.** `content_type` is an enum with exactly one
  member, `application/json`, verified against the live API. The Body tab says
  so rather than offering a dropdown that always fails.
- **No cookie jar, no proxy settings.** Meta's runtime makes the call, not us.

## Build order

1. **Shell** — sidebar tree, selection state, full-width frame, routing so a
   tool has its own URL and a reload lands back on it.
2. **Tool tabs** — move today's Params / Headers / Body editors and the test run
   into tabs behind a request bar. Mostly relocation, little new logic.
3. **Connector Auth tab** — the real gap: multiple API-key headers/query/body
   params, OAuth content type, and the mTLS certificate fields the checkbox
   already implies.
4. **User auth tab** — injection config plus login/refresh tools.
5. **Params polish** — `enum`, and refusing a duplicate key inline with Meta's
   own message.

Each slice ships and is proven against production before the next starts.

## Related

- `docs/meta-api/connectors.md`, `docs/meta-api/connector-tools.md`
- `docs/meta-api/connector-tools-capability-matrix.md` — what Meta enforces, as
  opposed to what it documents
- `docs/design/apple-principles-mapping.md` — the principles this has to satisfy
