# Connectors accept an enterprise-shaped body

## Job

Whoever connects a real business API has to describe the JSON it expects, and
enterprise APIs nest — an order with a customer object and a list of line items
— but the editor refused anything nested with "flat fields only, for a nested
object or list contact engineering", so those APIs could not be configured at
all; after this you paste the real payload and get a tree you can annotate.

Founder, 2026-09-07: "connectors should be able to support payloads like how an
enterprise would have. Complex JSONs, Authentications, Params etc etc."

This job covers the **JSON** half. Authentication and parameter gaps are listed
at the end and are not done.

## Proof

`tsc -b --force` clean. `jest` — **82 passed**, up from 71: eleven new tests,
nine of them pinning the encoding Meta enforces.

Deployed 2026-09-07. Bundle `index-CmPUMX6u.js`, md5
`9eda6aa3adf775ff71cab34a7108df64` — identical local and on the server.

### The encoding, as actually stored

Read back from the running app after saving a nested action through the UI:

```json
{"body":{"content_type":"application/json","params":{
  "note":{"type":"string"},
  "tags":{"type":"array","items":"{\"type\":\"string\"}"},
  "lines":{"type":"array","items":"{\"type\":\"object\",\"properties\":{\"sku\":\"{\\\"type\\\":\\\"string\\\"}\",\"qty\":\"{\\\"type\\\":\\\"integer\\\"}\"}}"},
  "customer":{"type":"object","properties":{"id":"{\"type\":\"integer\"}","vip":"{\"type\":\"boolean\"}"}}
}}}
```

Three levels of string-encoding on `lines` — the array's `items` is a string,
and inside it each of `properties.sku` and `properties.qty` is a string again.
That is exactly the rule Meta enforces, and exactly the path its error message
names:

> `request_definition.body.params.lines.items.properties.sku must be a JSON
> object string that describes a body field.`

### Browser proof

`e2e/nested-body.spec.ts` (`@nested-body`) — **1 passed** against production.
Pastes an enterprise payload, checks the tree it produces, saves, reloads,
reopens and checks the tree came back:

- `list of object` and `list of string` both render.
- A container offers **no** "who fills this in" control — there is nothing to
  fill — while nested leaves each get one.
- After a save and reload, at least four nested leaves come back with their own
  fill controls, and `sku`, `qty` and `vip` are all present.

Default suite unchanged.

### What this does not prove

That **Meta** accepts this payload. Storage is ours. The encoding is pinned by
unit tests against the shape Meta was observed to enforce across 39 live probes
on 2026-09-04, but it has not been re-submitted to Meta since this change. That
needs a throwaway tool on a paused agent, and is the next verification worth
doing.

## Notes

**The limit was ours, not Meta's.** The editor said "contact engineering"
because an earlier probe concluded Meta rejected nested bodies outright. It
rejected the *encoding*. The evidence for the wrong conclusion was our own
opaque `400`; Meta's real message was one field away in `api_call_log` the whole
time, and it named the exact path. That mistake kept this feature closed.

**Required-ness stops at the top level, deliberately.** Meta carries body
required-ness in `body.required` as a top-level string array. There is no
verified place to say it deeper, so nested rows render no checkbox rather than
one that silently does nothing. A test asserts `required` never appears on a
node.

**Containers get no fill control.** An object or a list of objects has nothing
to fill — the agent supplies the leaves and Meta assembles the shape. Offering
"fixed value" there would be offering a choice with no meaning.

**Pasting is the input method, not a fallback.** For a real payload with a dozen
nested fields, building it row by row would be miserable. Paste it, then
annotate. Descriptions and fixed values already typed are matched by key and
kept when the JSON is edited — including on nested children.

**Field order is not preserved.** A JSON object has no order, so after a save
the example JSON comes back in a different sequence than it was pasted. Not a
defect, but the operator will notice it, and it broke the first version of the
browser test, which asserted on `#body-0-0-fill` and passed only by luck before
saving.

## A mistake this made, and what it cost

The first version of the browser test clicked **the first Edit link in the
table** rather than the connector it had just created, and wrote its
`create_order` action onto a real connector — **"Google Sheets Export"**.

Found by probing every connector's actions rather than trusting the test's own
report. Removed by id through the app's own API; verified afterwards that all
six connectors are back to zero actions, which is where they were, since the
actions feature is new and none had any. Nothing of the founder's was lost, and
no IndiaMART connector was touched.

The spec now scopes to the row it created and asserts the connector's own
heading before writing anything. A test that touches the wrong production row is
worse than no test.

## Still not done — the rest of "enterprise"

Verified against `docs/meta-api/connectors.md`, all supported by Meta and not
exposed by our UI:

- **API-key auth allows only one header.** Meta accepts multiple headers, and
  also query params and body params, each with an optional prefix.
- **The mTLS checkbox has nowhere to put a certificate.** "Requires a client
  certificate" can be ticked, but there is no field for the PEM, so ticking it
  produces a connector that cannot work — another control that lies.
- **Per-user OAuth is entirely absent.** `user_auth_injection_config`, plus the
  login and refresh tool types, are not in the UI at all.
- **OAuth token request content type** is not configurable.
- **`enum` on a parameter is accepted by Meta and undocumented** — it is how you
  stop the agent inventing a value for a closed set, and the editor does not
  offer it.
- **A key used in both query and body is rejected by Meta** with a clear
  message; the editor lets you build it and fail on save.
