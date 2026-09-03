# Make the connector tool editor usable

## Job

An operator wiring an agent to a real external API opens the tool editor
deciding what to send in the request; they see Params / Headers / Body as
tabs with counts and a worked example body field, instead of one long
undifferentiated form and an empty `{}` that gives no clue what to type.

## Proof

- `npx tsc --noEmit` exit 0; `toolRequestDefinition.test.ts` passes.
- Post-deploy: build a tool against a real connector, run it from
  `RunToolModal`, and confirm the request Meta receives matches what the tabs
  describe.

Recorded in `docs/e2e-test-runs/`.

## Notes

Builds on the parameter editor already shipped 2026-08-25. Three visible
changes: the tabbed layout, the dialog widening from `max-w-md` to `max-w-4xl`,
and a new tool starting with one example body field rather than an empty
object.

I described this as "cosmetic tidy-up" to the founder when scoping from file
names, and corrected it after reading the diff — it is a real redesign of the
tool-building flow. Worth remembering as a reason not to categorise work from
filenames.

The path-parameter row deliberately shows static text where a required
checkbox would go, because Meta always treats path params as required
(`connector-tools.md`) — a toggle there would be a control that silently does
nothing.
