# Agent Connectors tab uses the shared connector editor (4 of 4)

## Job

Whoever opens an agent's Connectors tab now sees the exact same editor as
the Connectors section and the wizard — pick or create a connector, define
its actions with the real request builder, publish to this agent or any
other on the same WABA. Before this sequence of four commits, the tab was a
separate ~900-line hand-rolled implementation against the legacy per-agent
Connector/Tool API, with no action editor beyond a raw method+path form and
no relationship to the Connector Library. Completes the agent-tab piece of
R4/R6 slice 4.

## Proof

Type-checks clean against the real build config (`npx tsc -b --force`,
exit 0 — not just `tsc --noEmit`, which doesn't apply this project's
`noUnusedLocals`/`noUnusedParameters`). Owed before this slice deploys: a
real-app run on the reserved test agent showing the same connector in both
the section and the agent tab, edited once and correct in both.

## Notes

- `agent.wabaId` needed adding to the local `AgentApi` interface — the
  backend already serializes it (`Agent.wabaId`, `@JsonUnwrapped` into
  `AgentListItem`); nothing else changed.
- This closes out a four-commit sequence (see
  `connectors-agenttab-remove-tool-modal`,
  `connectors-agenttab-remove-tools-list`,
  `connectors-agenttab-remove-add-modal`) that removed the legacy
  Add/Edit Connector and Add/Edit Tool modals and the per-connector tools
  list, each split out because the whole rebuild doesn't fit one commit
  under the 400-line cap.
