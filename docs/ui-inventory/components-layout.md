# UI inventory: components-layout

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

## frontend/src/components/layout/AppShell.tsx

| Control | Name | Covered by |
|---|---|---|
| link | Switch feature | **—** |
| button | New chat | **—** |
| link | View all chats | **—** |
| button | Sign out | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/layout/ClientCommandBar.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Search all clients | **—** |
| button | All clients | **—** |

> **3 control(s) here have no accessible name** (icon-only: StatusIndicator). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/layout/ModuleSwitcherPill.tsx

| Control | Name | Covered by |
|---|---|---|
| button | View all features | **—** |

> **2 control(s) here have no accessible name** (icon-only: ChevronDown). Untestable by name, and a screen reader cannot announce them.

