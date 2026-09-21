# UI inventory: pages

**Generated — do not edit.** Run `node scripts/ui-inventory.js`.

Coverage is matched on accessible name, because that is what the e2e suite
selects by (this repo has no `data-testid` and must keep it that way). A control
with no accessible name is listed as a defect: it cannot be tested by name, and a
screen reader cannot announce it.

To find a control, grep this directory for its on-screen label.

## frontend/src/pages/AgentDetailPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Back to Agents | **—** |
| button | Retry resolving this agent | **—** |
| button | Thread Control | **—** |
| button | Pause | **—** |
| button | Test Agent | **—** |
| button | Cancel | **—** |
| button | Continue | **—** |
| button | Release to agent | **—** |
| button | Add FAQ | **—** |
| button | Add | **—** |
| button | Unpublish | apply-indiamart-skills.spec.ts, astrotalk-agent.spec.ts, astrotalk-faq-sync.spec.ts, astrotalk-verify.spec.ts |
| button | Delete FAQ: <…> | **—** |
| button | Websites | **—** |
| button | Delete website: <…> | **—** |
| button | Delete file: <…> | **—** |
| button | Add Tool | xml-api-in-ui.spec.ts |
| button | Run tool <…> | **—** |
| button | Edit tool <…> | **—** |
| button | Delete tool <…> | **—** |
| button | Delete tool | **—** |
| button | Add Connector | **—** |
| button | Edit connector <…> | **—** |
| button | Delete connector <…> | **—** |
| button | Delete connector | **—** |
| button | Publish handoff to Meta | **—** |
| button | Save changes | apply-indiamart-skills.spec.ts |
| button | Connect phone number | **—** |
| button | Trigger event | **—** |
| button | Delete agent | **—** |
| button | Remove from Meta | **—** |
| button | Publish | **—** |
| button | Discard draft | **—** |
| button | Remove | **—** |
| button | Close test panel | **—** |
| button | Send message | **—** |

> **8 control(s) here have no accessible name** (icon-only: Loader2, Icon, ChevronDown). Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/AgentsPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Create Agent | **—** |
| button | Filters | **—** |
| button | Add a label | **—** |
| button | Continue setup | **—** |
| button | Delete agent <…> | **—** |
| button | Create your first agent | **—** |

> **2 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/BusinessPersonaLibraryPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Save current persona | **—** |
| button | Publish | **—** |
| button | Delete persona draft <…> | **—** |
| button | Cancel | **—** |
| button | Deploy now | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/ConnectorEditPage.tsx

| Control | Name | Covered by |
|---|---|---|
| link | Back to Connectors | **—** |
| button | Edit | **—** |
| button | Add an action | **—** |
| button | Edit action <…> | **—** |
| button | Delete action <…> | **—** |
| button | Done | **—** |

## frontend/src/pages/ConnectorWorkbenchPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | New connector | action-feedback.spec.ts, astrotalk-connectors.spec.ts, astrotalk-payments.spec.ts |

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
| button | Add | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/pages/HumanHandoverPage.tsx

| Control | Name | Covered by |
|---|---|---|
| link | Go to Agents | **—** |

## frontend/src/pages/InboxPage.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Conversations | **—** |
| button | Webhooks | **—** |
| button | Conversation with <…> | **—** |
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

## frontend/src/pages/SettingsPage.tsx

| Control | Name | Covered by |
|---|---|---|
| a | Manage billing | **—** |
| button | Delete account | **—** |
| a | support@karix.com | **—** |

## frontend/src/pages/SkillEditPage.tsx

| Control | Name | Covered by |
|---|---|---|
| link | Back to Skills Library | **—** |
| button | Cancel | **—** |

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
| button | Next | **—** |
| button | Disconnect | **—** |
| button | View | **—** |
| button | Cancel | **—** |
| button | Validate | **—** |
| button | Back | **—** |
| button | Confirm &amp; Register | **—** |
| button | Add your first WABA | **—** |

