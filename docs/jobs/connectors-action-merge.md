# Connectors — action updates stop wiping fields they don't model

## Job

Whoever edits a connector action from a simpler editor (the wizard's, today —
the agent screen and section will use the same shared editor once the rest of
slice 4 lands) must not silently erase what a richer editor set on the same
action. Before this, saving from any editor replaced the whole stored
request definition, so a field one editor doesn't know about — Meta's
`transformation_spec` is the one the spec names — vanished the moment a
different editor saved. Part of `docs/user-stories/R4-R6-same-screen-everywhere.md`
slice 4, defect #9.

## Proof

Unit-tested — `ConnectorLibraryServiceTest`:
`should_keep_a_field_the_update_did_not_send` and
`should_let_an_update_explicitly_clear_a_field_by_sending_null`, both green
(`mvn -o test -Dtest=ConnectorLibraryServiceTest`, exit 0), alongside the
full existing suite for this class, unchanged and still green.

Not yet proven against real Meta — same open item as
`connectors-orphan-adoption`, held for the same deploy decision.

## Notes

- Semantics: a field the update omits keeps what was stored; a field it
  sends — including an explicit JSON `null` — replaces it. Top-level merge
  only, matching the shape `request_definition` actually has (method, path,
  headers, body, and whatever else Meta or an editor puts there).
- Deliberately does not special-case `transformation_spec` by name — the fix
  is general (any unmodeled field survives an edit from an editor that
  doesn't know about it), not a patch for one field Meta happens to use today.
- `createAction` is untouched: there is nothing to merge onto for a brand new
  action.
