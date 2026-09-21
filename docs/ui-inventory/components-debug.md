# UI inventory: components-debug

**Generated — do not edit.** Run `node scripts/ui-inventory.js`.

Coverage is matched on accessible name, because that is what the e2e suite
selects by (this repo has no `data-testid` and must keep it that way). A control
with no accessible name is listed as a defect: it cannot be tested by name, and a
screen reader cannot announce it.

To find a control, grep this directory for its on-screen label.

## frontend/src/components/debug/ApiCallsLog.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Clear filters | **—** |
| button | ms | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/debug/WebhookLogPanel.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Handoffs only | **—** |
| button | Filters | **—** |
| button | Clear | **—** |
| button | View | **—** |

