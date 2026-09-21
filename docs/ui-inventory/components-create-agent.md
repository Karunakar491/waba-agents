# UI inventory: components-create-agent

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

## frontend/src/components/create-agent/IrisRail.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Send to Iris | **—** |

## frontend/src/components/create-agent/SkillsLibraryDrawer.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Close Skills Library | edit-flows.spec.ts |
| link | See full Skills Library → | **—** |

> **2 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/create-agent/StepBusinessPersona.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Sample reply | **—** |

## frontend/src/components/create-agent/StepConnectors.tsx

| Control | Name | Covered by |
|---|---|---|
| button | + Add connector | xml-api-in-ui.spec.ts |
| button | Remove connector: <…> | **—** |
| button | Save & connect | edit-flows.spec.ts |

> **1 control(s) here have no accessible name** (icon-only: Plug). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/create-agent/StepEvals.tsx

> **1 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/create-agent/StepKnowledgeBase.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Remove FAQ: <…> | **—** |
| button | Remove file: <…> | **—** |
| button | Remove website: <…> | **—** |

## frontend/src/components/create-agent/StepSkills.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Remove rule: <…> | **—** |
| button | + Add component | **—** |
| button | Remove component: <…> | **—** |
| button | Save component | edit-flows.spec.ts |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/create-agent/StepTestDeploy.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Send test message | **—** |
| button | Reset conversation | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/create-agent/WizardChrome.tsx

> **4 control(s) here have no accessible name** (icon-only: ArrowLeft, Loader2). Untestable by name, and a screen reader cannot announce them.

