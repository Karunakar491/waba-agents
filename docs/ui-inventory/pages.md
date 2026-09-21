# UI inventory: pages

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

## frontend/src/pages/AgentDetailPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Back to Agents | **—** |
| button | Retry resolving this agent | **—** |
| button | Thread Control | **—** |
| button | Pause | **—** |
| button | Test Agent | **—** |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |
| button | Continue | session-refresh.spec.ts, create-agent.spec.ts, edit-flows.spec.ts, handoff-shot.spec.ts, indiamart-body.spec.ts, journey-editable.spec.ts, shots.spec.ts, walk.spec.ts, walk2.spec.ts, walk3.spec.ts, xml-api-in-ui.spec.ts |
| button | Release to agent | **—** |
| button | Add FAQ | **—** |
| button | Add | xml-api-in-ui.spec.ts |
| button | Unpublish | **—** |
| button | Delete FAQ: <…> | **—** |
| button | Websites | **—** |
| button | Delete website: <…> | **—** |
| button | Delete file: <…> | **—** |
| button | Add Tool | xml-api-in-ui.spec.ts |
| button | Run tool <…> | **—** |
| button | Edit tool <…> | deployed-features.spec.ts |
| button | Delete tool <…> | **—** |
| button | Delete tool | xml-api-in-ui.spec.ts |
| button | Add Connector | xml-api-in-ui.spec.ts |
| button | Edit connector <…> | deployed-features.spec.ts |
| button | Delete connector <…> | **—** |
| button | Delete connector | action-feedback.spec.ts, connector-delete.spec.ts, xml-api-in-ui.spec.ts |
| button | Publish handoff to Meta | **—** |
| button | Save changes | edit-flows.spec.ts |
| button | Connect phone number | **—** |
| button | Trigger event | **—** |
| button | Delete agent | **—** |
| button | Remove from Meta | **—** |
| button | Publish | connector-delete.spec.ts, multi-header-auth.spec.ts |
| button | Discard draft | **—** |
| button | Remove | **—** |
| button | Close test panel | edit-flows.spec.ts |
| button | Send message | **—** |

> **8 control(s) here have no accessible name** (icon-only: Loader2, Icon, ChevronDown). Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/AgentsPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Create Agent | **—** |
| button | Filters | **—** |
| button | Add a label | **—** |
| button | Continue setup | session-refresh.spec.ts, create-agent.spec.ts, edit-flows.spec.ts, handoff-shot.spec.ts, indiamart-body.spec.ts, journey-editable.spec.ts, shots.spec.ts, walk.spec.ts, walk2.spec.ts, walk3.spec.ts, xml-api-in-ui.spec.ts |
| button | Delete agent <…> | inbox-and-delete.spec.ts |
| button | Create your first agent | **—** |

> **2 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/BusinessPersonaLibraryPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Save current persona | edit-flows.spec.ts |
| button | Publish | connector-delete.spec.ts, multi-header-auth.spec.ts |
| button | Delete persona draft <…> | **—** |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |
| button | Deploy now | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/ConnectorWorkbenchPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | New connector | action-feedback.spec.ts |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/DashboardPage.tsx

| Control | Name | Covered by |
|---|---|---|
| link | + more — view all in Agents | **—** |

> **2 control(s) here have no accessible name** (icon-only: StatusIndicator, AlertTriangle). Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/DebugPage.tsx

> **1 control(s) here have no accessible name** (icon-only: Icon). Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/FileLibraryPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Add | xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/HumanHandoverPage.tsx

| Control | Name | Covered by |
|---|---|---|
| link | Go to Agents | **—** |

## frontend/src/pages/InboxPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Conversations | **—** |
| button | Webhooks | handoff-shot.spec.ts |
| button | Conversation with <…> | inbox-and-delete.spec.ts |
| button | View originating webhook | **—** |
| button | Go to Agents | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/LoginPage.tsx

> **2 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/NotFoundPage.tsx

| Control | Name | Covered by |
|---|---|---|
| link | Back to dashboard | **—** |

## frontend/src/pages/ProfilePage.tsx

> **1 control(s) here have no accessible name** (icon-only: ExternalLink). Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/ReportsPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Run rollup | **—** |

> **2 control(s) here have no accessible name** (icon-only: Icon). Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/SkillEditPage.tsx

| Control | Name | Covered by |
|---|---|---|
| link | Back to Skills Library | **—** |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/SkillLibraryPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Browse templates | **—** |
| button | Delete skill <…> | **—** |

> **2 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/SkillTemplateBrowsePage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | View | **—** |
| button | Copy to my Skills | **—** |

> **1 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/TemplateDebugPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Filters | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/TemplateIrisAllChatsPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Iris | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/TemplateSettingsPage.tsx

| Control | Name | Covered by |
|---|---|---|
| link | Open Debug | **—** |

## frontend/src/pages/TemplateStudioPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Back to templates | **—** |

## frontend/src/pages/WabaDetailPage.tsx

| Control | Name | Covered by |
|---|---|---|
| link | Back to WABAs | **—** |

## frontend/src/pages/WabasPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Add WABA | **—** |
| button | Previous | **—** |
| button | Next | create-agent.spec.ts, walk2.spec.ts |
| button | Disconnect | action-feedback.spec.ts |
| button | View | **—** |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |
| button | Validate | **—** |
| button | Back | **—** |
| button | Confirm &amp; Register | **—** |
| button | Add your first WABA | **—** |

