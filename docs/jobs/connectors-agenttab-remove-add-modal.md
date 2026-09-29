# Agent Connectors tab — remove Add/Edit Connector modal (3 of 4)

## Job

Third step of rebuilding the agent's own Connectors tab (R4/R6 slice 4).
Removes the legacy per-agent "Add/Edit Connector" modal — a connector row
now shows status and delete only; adding or editing moves to the shared
Connector Library editor in the final step of this sequence.

## Proof

Type-checks clean (`npx tsc --noEmit`, exit 0). Mid-rebuild; functional
proof lands once the whole sequence is committed.

## Notes

Final step: replace what remains of `ConnectorsTab` (list + delete only) and
the last legacy helper types with the embedded shared workbench.
