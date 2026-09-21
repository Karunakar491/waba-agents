# UI inventory: components-agent-detail

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

## frontend/src/components/agent-detail/BusinessProfileTab.tsx

| Control | Name | Covered by |
|---|---|---|
| button | New draft | **—** |
| button | Edit | deployed-features.spec.ts, edit-flows.spec.ts |
| button | Deploy | **—** |
| button | Delete draft | **—** |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/agent-detail/DeleteAgentModal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Close | edit-flows.spec.ts, xml-api-in-ui.spec.ts |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/agent-detail/DeleteFromMetaModal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Remove from Meta | **—** |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |

## frontend/src/components/agent-detail/DraftsDisclosure.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Drafts | **—** |
| button | Republish | **—** |

## frontend/src/components/agent-detail/EvalTab.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Run eval | **—** |
| button | Previous | **—** |
| button | Next | create-agent.spec.ts, walk2.spec.ts |

## frontend/src/components/agent-detail/RunToolModal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Run | xml-api-in-ui.spec.ts |
| button | Close | edit-flows.spec.ts, xml-api-in-ui.spec.ts |

## frontend/src/components/agent-detail/SkillEditorModal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/agent-detail/SkillsTab.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Sync skills | **—** |
| button | Add skill | **—** |
| button | Dismiss | **—** |
| button | Clear search | **—** |
| button | Promote to Library — share this skill across agents on this WABA | **—** |
| button | Unpublish | **—** |
| button | Delete skill <…> | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/agent-detail/ToolBodyEditor.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Example JSON | **—** |
| button | Beautify | **—** |

## frontend/src/components/agent-detail/ToolParamsEditor.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Add | xml-api-in-ui.spec.ts |
| button | Remove <…> <…> | **—** |

## frontend/src/components/agent-detail/TriggerEventModal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Send event | **—** |

## frontend/src/components/agent-detail/UiSkillEditorModal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/agent-detail/UiSkillsPanel.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Add UI skill | **—** |
| button | — | **—** |
| button | Unpublish | **—** |
| button | Delete UI skill <…> | **—** |

## frontend/src/components/agent-detail/UnpublishConfirmModal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |
| button | Unpublish | **—** |

