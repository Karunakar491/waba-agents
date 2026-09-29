# Wizard step order — Connectors before Skills

## Job

Whoever is creating an agent now defines Connectors before Skills in the
wizard, so a skill written on the following step has a real connector
action to call rather than an empty picker. Ships alongside the rest of
R4/R6 slice 4, per the requirements doc ("the step reorder ships with
slice 4, not before: moving Connectors ahead of Skills only helps once
that step can define actions" — now it can, as of the prior four commits).

## Proof

Type-checks clean against the real build (`npx tsc -b --force`, exit 0).
The `IrisRail`-hiding condition (previously keyed to Skills at step 4) is
updated to Skills' new position, step 5. Owed before deploy: a real
click-through of the wizard end to end proving Connectors renders at step 4
and Skills at step 5, with Back/Next correct at every step.

## Notes

An agent whose wizard draft was left mid-flow at the OLD step 4 (Skills)
before this deploys will resume showing Connectors instead — the persisted
`draft.step` is a plain ordinal, not a named step. Acceptable: this is
wizard-only, in-progress-draft state, not customer-facing data, and no
drafts are known to exist in this state currently.
