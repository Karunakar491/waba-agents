# Fixed and macro values for connector tool body fields

## Job

Whoever configures a connector tool opens the tool editor deciding whether the
tool sends the exact request the partner's API requires; today the body box can
only produce agent-filled fields, so a body field that must carry a constant —
IndiaMART's mandatory `action: "product-search"` — cannot be expressed at all,
and they see a "who fills this in" control per body field, matching the one
query and header parameters already have.

## Proof

### Produced at commit time

`npx jest` — **61 passed**, of which 21 in
`src/components/agent-detail/toolRequestDefinition.test.ts`. `npx tsc -b` clean.

Four of those tests are new and each pins a behaviour that did not exist before:

- a fixed body field serializes to `binding: { kind: 'default', value: … }`,
  a macro one to `kind: 'macro'`, and an agent-filled one carries **no**
  `binding` key at all;
- that round-trips back through `parseRequestDefinition` unchanged, so opening
  the editor on a saved tool does not silently drop the constant;
- retyping the example JSON preserves a field's fixed value, rather than
  reverting it to agent-filled;
- a row carrying no `fill` renders a type example, not the literal string
  `"<undefined>"` — a real bug the first version of this change introduced and
  the pre-existing `bodyRowsToJson` test caught.

### Produced against the running app

Deployed to production: bundle `index-CyXE6SKl.js`, served md5
`bc39c2782c457515e0bfe91a4261f781`, hash-compared against the local build from
`d0e9c2a`. Rollback tarball `/tmp/metaagent-backup-20260903212710.tar.gz`.

**1. Configured entirely through the UI**, no direct API call — driven by
`frontend/e2e/tools/indiamart-body.spec.ts`, which logs in, opens the IndiaMART
agent's Connectors tab, expands the connector, opens `Edit tool product_search`,
clears the query string, types the partner's payload into the body box, and sets
`action` to **Fixed value**. Screenshot of that state:
`docs/e2e-test-runs/2026-09-04-tool-body-fixed-value.png`.

Save returned `PUT 200`, and reading the tool back from Meta gives:

```json
{
  "method": "POST",
  "path": "/",
  "body": {
    "content_type": "application/json",
    "params": {
      "action": {
        "type": "string",
        "description": "Fixed action selector required by the endpoint.",
        "binding": { "kind": "default", "value": "product-search" }
      },
      "city":  { "type": "string", "description": "The city the buyer named, e.g. Delhi. Leave empty if the buyer gave no location." },
      "query": { "type": "string", "description": "The product or service the buyer is searching for, e.g. Aata Chakki Machine." }
    },
    "required": ["query"]
  }
}
```

`binding` on a body param is the field the UI had no control for. Meta stored it,
so the control works end to end: UI → our API → Meta → read back.

**2. `city` now reaches IndiaMART**, through Meta's own tool runtime
(`POST .../tools/{id}/run`) — the same path the live agent uses:

| input | cities returned |
|---|---|
| `{"query":"biryani"}` | Hyderabad, Greater Noida |
| `{"query":"biryani","city":"Delhi"}` | **New Delhi, New Delhi** |
| `{"query":"biryani","city":"Mumbai"}` | **Mumbai, Vasai Virar** |
| `{"query":"TMT Bars","city":"Pune"}` | **Pune, Pune** |

Before this change every one of those returned Hyderabad/Greater Noida —
identical to the no-city call — because `city` was undeclared and Meta dropped it
silently. Pre-change evidence in
`docs/jobs/indiamart-api-contract-2026-09-04.md`.

### The curl could not be matched byte-for-byte, and why

The partner's curl sends `action` **twice** — as `?action=product-search` and
again in the body. Meta rejects that: a key declared in both `query_parameters`
and `body` fails with `Meta API error: 400`. Established by probing four shapes
on a throwaway tool rather than by guessing at the live one:

| shape | result |
|---|---|
| `binding` in body **and** `action` in query string | **400** |
| `binding` in body only | 200 |
| body with no `binding` | 200 |
| `binding` in body + `required` array | 200 |

So `binding` on a body param was never the problem — the duplicate key was. The
tool now sends `action` in the body only, which is the working equivalent: the
endpoint accepts `action` from either location (verified directly, test C), and a
body value overrides a query-string one of the same name anyway (test E). All
three probe tools were deleted; `product_search` is the only tool on the
connector.

`required` is `["query"]` alone. `action` is injected by its binding so it is
always present, and `city` is genuinely optional — marking either one required
would tell the agent to go and extract a value it should not be extracting.

## Notes

Scope is the editor only. The IndiaMART journey rework (skills and UI skills) is
a separate job — this one just makes the request shape expressible.

Body fields get the **same** `FillMode` union as path/query/header params rather
than a fixed-only flag, because `BizAIOmniChannelConnectorToolBodyNode` supports
the full `ParameterBinding` (`docs/meta-api/connector-tools.md`), macros
included. A narrower control would have been a second, subtly different model of
the same wire field.

`required` stays where it was: a `string[]` on `body`, never a per-field boolean
on the node. That distinction is the defect class this editor was built to
prevent, and it is still covered by its own test.

Two gaps found while verifying, neither fixed here:

- **Our API hides Meta's error.** A rejected tool save surfaces only
  `{"success":false,"error":"Meta API error: 400"}`. Meta's own reason is
  discarded, so the only way to find out that a duplicate key was the problem was
  to probe four shapes by hand. An operator hitting this in the UI has no path
  forward at all. Worth fixing in `MetaApiClient`.
- **The Required checkbox on a body row has no `id`**, unlike the fill, value and
  description controls beside it, so it can only be targeted positionally. Also
  the row wraps awkwardly once the fixed-value input appears — visible in the
  screenshot, where `action`'s Required checkbox drops to a second line.

Known and deliberately not addressed here: every IndiaMART image URL is plain
`http://N.imimg.com` and returned 403/404 for all 24 URLs probed from our
network. That blocks the `carousel_url` / `image` UI Skills and belongs to the
journey job, not this one.
