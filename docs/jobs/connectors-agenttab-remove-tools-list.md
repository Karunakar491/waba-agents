# Agent Connectors tab — remove tools list and expand (2 of 4)

## Job

Second step of rebuilding the agent's own Connectors tab (R4/R6 slice 4).
Removes the per-connector expand/tools list (`ToolsList`) and its chevron
toggle — a connector row now shows only its status, edit and delete, since
its tools move to the shared editor in a later commit in this sequence.

## Proof

Type-checks clean (`npx tsc --noEmit`, exit 0). Mid-rebuild; functional
proof lands once the whole sequence is committed.

## Notes

Next: remove the Add/Edit Connector modal, then replace what remains of
`ConnectorsTab` with the embedded shared workbench.
