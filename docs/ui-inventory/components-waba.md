# UI inventory: components-waba

**Generated — do not edit.** Run `node scripts/ui-inventory.js`.

Coverage is matched on accessible name, because that is what the e2e suite
selects by (this repo has no `data-testid` and must keep it that way). A control
with no accessible name is listed as a defect: it cannot be tested by name, and a
screen reader cannot announce it.

To find a control, grep this directory for its on-screen label.

## frontend/src/components/waba/ConnectPhoneModal.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Where do I find my WABA ID? | **—** |
| button | Cancel | **—** |
| button | Continue | **—** |
| button | Back | **—** |

> **3 control(s) here have no accessible name** (icon-only: Loader2, Phone). Untestable by name, and a screen reader cannot announce them.

