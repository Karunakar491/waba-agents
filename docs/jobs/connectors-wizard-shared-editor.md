# Connectors — wizard uses the shared connector editor (2 of 2)

## Job

Whoever is creating an agent and reaches the Connectors step now sees the
exact same editor as the Connectors section and the agent's own tab — pick
or create a connector, define its actions with the real request builder,
publish it to this agent or any other on the same WABA. Before this, the
wizard's own form couldn't define an action at all, so a connector created
there could never be published. Completes R4/R6 slice 4's wizard piece,
acceptance criterion #12 (define a connector and an action in the wizard).

## Proof

Type-checks clean (`npx tsc --noEmit`, exit 0). Owed before this slice
deploys: a real-app run creating a connector and an action from inside the
wizard, then publishing it to the reserved test agent and proving it's
callable — held for the same deploy decision as the rest of this slice.

## Notes

- `agentId` is deliberately unused — the shared editor's publish flow picks
  its target from every agent on the connector's WABA, which already
  includes the draft agent this wizard is building. No wizard-specific
  restriction was added; this is the same screen everywhere, on purpose.
- The step is now a fixed 560px box (`overflow-hidden rounded-lg border`)
  rather than the page's own full-viewport layout — `ConnectorWorkbenchPage`
  fills whatever box it's given when `embedded`, per the previous commit.
