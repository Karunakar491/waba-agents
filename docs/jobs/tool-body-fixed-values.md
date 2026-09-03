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

Appended below once the bundle is deployed and the IndiaMART tool has actually
been re-saved through the UI: the read-back `request_definition` showing
`binding` on a body param, the before/after `city` behaviour through Meta's tool
runtime, and a screenshot of the control. Until that line is replaced this job is
code-complete, not done.

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

Known and deliberately not addressed here: every IndiaMART image URL is plain
`http://N.imimg.com` and returned 403/404 for all 24 URLs probed from our
network. That blocks the `carousel_url` / `image` UI Skills and belongs to the
journey job, not this one.
