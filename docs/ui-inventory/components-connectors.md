# UI inventory: components-connectors

**Generated — do not edit.** Run `node scripts/ui-inventory.js`.

Coverage is matched on accessible name, because that is what the e2e suite
selects by (this repo has no `data-testid` and must keep it that way). A control
with no accessible name is listed as a defect: it cannot be tested by name, and a
screen reader cannot announce it.

**Read coverage as an upper bound.** Names are matched as strings and as the
regexes Playwright specs actually use, so two different buttons that read
"Continue" on two different screens both count as driven by any spec clicking
either. It answers "has anything ever pressed a control by this name?", not
"is this journey tested?". Only the uncovered column is exact.

To find a control, grep this directory for its on-screen label.

## frontend/src/components/connectors/ActionEditor.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Advanced | **—** |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/connectors/ConnectorDefinitionEditor.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Remove header <…> | **—** |
| button | Add another header | multi-header-auth.spec.ts |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/connectors/ConnectorDeployModal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |
| button | Publish to this agent | connector-delete.spec.ts |

## frontend/src/components/connectors/ConnectorsTable.tsx

| Control | Name | Covered by |
|---|---|---|
| link | Edit | deployed-features.spec.ts, edit-flows.spec.ts |

## frontend/src/components/connectors/workbench/ActionAuthPane.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Remove credential <…> | **—** |
| button | Add another header | multi-header-auth.spec.ts |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/connectors/workbench/ConnectorActionsTable.tsx

> **2 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/connectors/workbench/ConnectorPane.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Publish | connector-delete.spec.ts, multi-header-auth.spec.ts |
| button | Delete connector | action-feedback.spec.ts, connector-delete.spec.ts, xml-api-in-ui.spec.ts |

## frontend/src/components/connectors/workbench/ImportCurl.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Import a cURL command | curl-import.spec.ts |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |
| button | Check it | curl-import.spec.ts |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/connectors/workbench/NewConnectorPane.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/connectors/workbench/PropertyTable.tsx

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/connectors/workbench/RequestBar.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Send | **—** |

## frontend/src/components/connectors/workbench/ToolPane.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Delete action <…> | **—** |

> **2 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/connectors/workbench/WorkbenchSidebar.tsx

| Control | Name | Covered by |
|---|---|---|
| button | New connector | action-feedback.spec.ts |
| button | ${isOpen ? | **—** |
| button | Add an action | **—** |
| button | on agent | **—** |

> **2 control(s) here have no accessible name** (icon-only: MethodBadge). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/connectors/workbench/WorkbenchTabs.tsx

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

