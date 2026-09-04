# Connector Tools — what Meta actually accepts

39 shapes submitted to the live API on 2026-09-04, each as a throwaway tool that
was deleted immediately after. Meta's own error text was recovered from
`GET /reports/api-calls` (`responseBody`), not inferred from our `400`.

Probe script: `scratchpad/matrix.js` in the session that produced this. Raw
results: `matrix-results.json`.

**This supersedes parts of `connector-tools.md`, which describes the schema as
written rather than as enforced.**

## Body content type — JSON only, and that is a hard wall

| `content_type` | Result |
|---|---|
| `application/json` | **accepted** |
| `application/xml` | rejected |
| `text/xml` | rejected |
| `application/soap+xml` | rejected |
| `application/x-www-form-urlencoded` | rejected |
| `multipart/form-data` | rejected |
| `text/plain` | rejected |

> `violated JSON schema constraint 'enum' for the JSON field
> 'request_definition.body.content_type'`

It is an **enum with one member**. There is no flag to turn on and no shape to
get right.

**This constrains the request body only — and that distinction turns out to be
the whole story.** See the next section: XML *responses* work fine.

So the actual boundary is narrower than "no XML":

- An API that needs an **XML/SOAP request body** cannot be called at all. It
  needs a JSON-speaking shim of ours in front of it — a product decision, not a
  config one.
- An API driven by **GET/query/path/header parameters that returns XML works
  today**, with no shim and no code change.

## Non-JSON responses — XML works, verified

Probed on 2026-09-04 with a throwaway `NONE`-auth connector pointing at
`httpbin.org`, deployed to the paused agent (never the IndiaMART one), two tools
on the same connector, then fully torn down.

`GET /xml` → `application/xml`:

```
status: { "code": 1 }        (success)
output.status: 200
output.data: "<?xml version='1.0' encoding='us-ascii'?>\n\n<slideshow title=\"Sample Slide Show\" ...>"
output.headers: { "content-type": "application/xml", "content-length": "522", ... }
```

`GET /json` → `application/json`, same connector, as a control:

```
output.data: { "slideshow": { "author": "Yours Truly", "slides": [ ... ] } }
```

So Meta is **content-type aware**: JSON is parsed into an object, anything else is
handed through as a **raw string**, with response headers preserved either way.
An agent can read XML perfectly well as text.

Consequences worth acting on:

- A read-only XML/RSS/legacy-REST API is usable **right now**. No gateway needed.
- The tool's `description` should tell the agent the response is XML, since it
  arrives as an unlabelled string.
- Response `headers` are visible to the tool result — useful, and also a reason
  not to put anything sensitive in a response header.

**Correction:** an earlier statement in this session that "Meta doesn't support
XML" was too broad. It cannot *send* an XML body; it consumes XML responses
without trouble.

## Body structure — nesting IS supported, string-encoded

Each nested node must be a **JSON-encoded string**, not an inline object. This is
what `connector-tools.md` means by typing `items` as `string`, and it applies
recursively to `properties` values too.

| Shape | Result |
|---|---|
| flat scalars | **accepted** |
| object, `properties` values as JSON strings | **accepted** |
| object, `properties` inline objects | rejected |
| object, whole `properties` as one JSON string | rejected |
| array, `items` as a JSON string | **accepted** |
| array, `items` as an inline object | rejected |
| array of objects, nested `properties` string-encoded | **accepted** |
| two-level object, string-encoded at each level | **accepted** |
| nested leaf carrying a fixed `binding` | **accepted** |
| `body.required` as a top-level `string[]` | **accepted** |

Meta's message is what gives the rule away — it names the exact path and repeats
at each level:

> `request_definition.body.params.lines.items.properties.sku must be a JSON
> object string that describes a body field.`

So a valid nested body looks like this — note `properties` is a real map whose
*values* are strings:

```json
{
  "content_type": "application/json",
  "params": {
    "home": {
      "type": "object",
      "description": "n",
      "properties": {
        "delhi": "{\"type\":\"string\",\"description\":\"a city\"}"
      }
    }
  }
}
```

**Correction:** an earlier conclusion in this session that "Meta rejects nested
request bodies outright" was **wrong**. It rejected the encoding, not the
capability. The evidence for the wrong conclusion was our own opaque `400`; the
right answer was one field away in `api_call_log` the whole time.

Consequence: `ToolBodyEditor`'s "flat fields only — for a nested object or list,
contact engineering" is a self-imposed limit, not a platform one, and is now
worth building out.

## Methods

`GET`, `POST`, `PUT`, `PATCH`, `DELETE` accepted. `HEAD` and `OPTIONS` rejected
(`enum` on `request_definition.method`). A `GET` **with** a body is accepted by
the schema — untested whether the body is actually sent.

## Path / query / header parameters

| Feature | Result |
|---|---|
| `string`, `integer`, `number`, `boolean` | **accepted** |
| `object` or `array` as a query param type | rejected — scalars only |
| `enum: [...]` on a parameter | **accepted — undocumented** |
| fixed `binding` on a header | **accepted** |
| fixed `binding` on a path parameter | **accepted** |
| same key in both `query_parameters` and `body.params` | rejected |

`enum` is not in `connector-tools.md` and is worth surfacing in the editor — it
is how you stop the agent inventing a value for a closed set.

The duplicate-name rejection has a genuinely clear message, and the editor should
show it verbatim instead of letting the operator build the shape and fail on save:

> `request_definition uses duplicate top-level input name "action" in
> query_parameters and body.params.`

## Macros

`WHATSAPP_PHONE_NUMBER`, `WHATSAPP_IDENTITY_HASH`, `WHATSAPP_CURRENT_STATUS_ID`
accepted. An unknown macro name is rejected, so the set is closed — the editor's
three options are complete.

## Two defects found while probing

1. **Our API discards Meta's reason.** Every failure above surfaces to the caller
   as `{"success":false,"error":"Meta API error: 400"}`. The real message is
   captured in `MetaApiException.responseBody` and stored in `api_call_log`, but
   never returned. It is the single reason this matrix took probing rather than
   reading — and an operator in the UI has no route to it at all.
2. **`GET /reports/api-calls?outcome=FAILURE` returns HTTP 500.** Any other
   filter combination works; that one parameter breaks it, so the fastest way to
   find failures is to fetch unfiltered and filter client-side.

## Not covered

- What Meta does with a non-JSON **response** body.
- Whether a `GET` body is actually transmitted.
- Connector-level auth types (this matrix is tool-level only).
- Response size limits, timeouts, redirect handling.
