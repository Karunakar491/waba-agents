# UI inventory: components-waba

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

## frontend/src/components/waba/ConnectPhoneModal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Where do I find my WABA ID? | **—** |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |
| button | Continue | session-refresh.spec.ts, create-agent.spec.ts, edit-flows.spec.ts, handoff-shot.spec.ts, indiamart-body.spec.ts, journey-editable.spec.ts, shots.spec.ts, walk.spec.ts, walk2.spec.ts, walk3.spec.ts, xml-api-in-ui.spec.ts |
| button | Back | **—** |

> **3 control(s) here have no accessible name** (icon-only: Loader2, Phone). Untestable by name, and a screen reader cannot announce them.

