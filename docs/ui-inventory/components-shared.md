# UI inventory: components-shared

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

## frontend/src/components/shared/ActionFeedback.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Dismiss | **—** |

## frontend/src/components/shared/Button.tsx

> **1 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/shared/ConfirmDeleteModal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/shared/CopyButton.tsx

> **2 control(s) here have no accessible name** (icon-only: Check). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/shared/CopyableId.tsx

> **1 control(s) here have no accessible name** (icon-only: Check). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/shared/ErrorBanner.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Retry | **—** |

## frontend/src/components/shared/ErrorBoundary.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Try again | **—** |

## frontend/src/components/shared/Modal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Close | edit-flows.spec.ts, xml-api-in-ui.spec.ts |

## frontend/src/components/shared/ModuleCard.tsx

| Control | Name | Covered by |
|---|---|---|
| button | } tone= /> | **—** |

## frontend/src/components/shared/SegmentedControl.tsx

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

