# Connector tables redesign

## Job

Rebuild the connector section on one rule: **everything editable is a row in a
table, with one grammar, no exceptions.** The founder asked for the task list
first — it is `docs/design/connector-section-redesign-tasks.md`, with each task
tied to the principle it fixes.

This job covers T1–T7 and T9. T8 (creating actions as real Meta tools at
publish) is backend, is the only item that changes what the product *does*, and
gets its own job rather than being smuggled into a layout pass.

The rule, and why it is a table rather than a form:

- **Consistency** — the section currently uses five patterns for one job:
  connector Details is a stack of inputs, Authorization is a different stack
  with its own row markup, an action's Params is a table, its Name is a lone
  floating input, its Body is a textarea plus a table.
- **Recognition over recall** — a table shows every field and its value at
  once.
- **Direct manipulation** — the value is edited where it is shown.
- **Deference** — a table is almost all content; a form's labels, help text and
  panel chrome are not.

## Proof

Each task's own section below records what proved it. The section-wide checks:

- `@workbench`, `@nested-body`, `@multi-auth`, `@connector-delete`, `@feedback`
  green against production after each deploy.
- Default suite green.
- Screenshots at 1440x900 in `frontend/e2e-shots/`.
