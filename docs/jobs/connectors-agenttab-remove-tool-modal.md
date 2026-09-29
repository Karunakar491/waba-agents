# Agent Connectors tab — remove Add/Edit Tool modal (part 1 of the agent-tab rebuild)

## Job

First step of rebuilding the agent's own Connectors tab to use the shared
connector editor instead of its separate hand-rolled implementation (R4/R6
slice 4). This step removes the legacy per-agent "Add/Edit Tool" modal and
the tools list's ability to open it — a tool can still be run or deleted
from this tab, just not added or edited here any more, since that will move
to the shared editor in a later commit. Split into small steps because the
whole legacy block (~900 lines) can't fit one commit under the 400-line cap.

## Proof

Type-checks clean (`npx tsc --noEmit`, exit 0). This tab is mid-rebuild —
functional proof (agent tab showing the same connectors as the section)
lands once the whole rebuild is committed.

## Notes

Next: remove the tools list itself, then the Add/Edit Connector modal, then
replace what remains of `ConnectorsTab` with the embedded shared workbench.
