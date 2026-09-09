# Request tables

## Job

The founder, with a screenshot of Postman's Headers tab: "Cant we have
everything in tables like this? If a user adds some body, Lets show the table
below the body section or something which is for fields mapping and all."

Three parts.

**1. Params and Headers get real columns.** They are already tables, but only
three: Key, Value, Description — and the type dropdown and the Required
checkbox are both stuffed into the Description cell as a second line. Type and
Required each get a column of their own.

`Key | Type | Value | Description | Required | ✕`

**2. Headers shows what is sent without being asked for.** Postman greys in
`Content-Type`, `Host`, `Content-Length`. Ours has two of its own:

- `Content-Type: application/json` — Meta's `content_type` is an enum with one
  member, so we cannot change it and neither can the user.
- one row per credential header from the connector's `auth_config`, value shown
  as typed-at-publish.

Both are read-only. Without them a technical user adds a `Content-Type` header
by hand and we silently ignore it — the exact confusion Postman's grey rows
exist to prevent.

**3. Body gets a flat mapping table under the JSON box.** The JSON stays: it is
how you author a shape quickly. Below it, one row per field with its dotted
path — `customer.id`, `lines[].sku` — its type, who fills it, and its
description. The nested indented editor repeated the shape the JSON already
showed, and got hard to scan at two levels deep.

Container rows stay in the table (their `description` is really sent — verified
in `buildBodyNode`), with no fill control, because Meta assembles the shape
around the leaves.

## Not copied from Postman

The **checkbox column that disables a row**. Meta has no notion of a disabled
parameter or header; a checkbox that appeared to switch a field off would do
nothing. The checkbox column here is `Required`, which is real and maps to
`body.required` / a parameter's `required`.

## Proof

Deployed as `index-I5PE6OX1.js`, md5 `7bdeef843a7d34619799aefea4f2de76`,
verified served by nginx and referenced by the live `index.html`.

- `@nested-body` + `@workbench` — 2 passed. The nested-body one is the one that
  matters: it pastes an object, a list of objects and a list of strings, and now
  asserts the rows come back named `lines[].sku`, `lines[].qty`,
  `customer.vip`. Those assertions were `sku`, `qty`, `vip` — they had to
  change, which is the point: a row is addressed by its full path now.
- `@multi-auth`, `@connector-delete`, `@feedback` — 6 passed.
- Default suite — 12 passed.
- 82 unit tests on `toolRequestDefinition` untouched and green. The wire format
  does not move in this job, only the way it is edited — that is the whole
  reason the existing tests are the right check here.

Screenshot: `frontend/e2e-shots/wb-action.png` — `{ "order": { "id": 42 } }`
pasted, producing `order` (object, "built from its fields") and `order.id`
(integer, "Agent fills this in").
