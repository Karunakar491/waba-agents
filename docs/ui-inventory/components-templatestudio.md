# UI inventory: components-templatestudio

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

## frontend/src/components/templatestudio/AiProviderPanel.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Replace | **—** |
| button | Save key | edit-flows.spec.ts |

## frontend/src/components/templatestudio/BulkImportPanel.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Choose file | **—** |

## frontend/src/components/templatestudio/DebugFiltersPanel.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Clear all | **—** |
| button | Done | xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/templatestudio/IrisChatPane.tsx

| Control | Name | Covered by |
|---|---|---|
| button | · | **—** |
| button | Scroll to latest message | **—** |
| button | Retry | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/templatestudio/IrisComposer.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Remove attachment | **—** |
| button | Attach an image | **—** |
| button | Attach a template sample sheet | **—** |
| button | Stop | **—** |
| button | Send | **—** |
| link | Settings | edit-flows.spec.ts |

## frontend/src/components/templatestudio/IrisConfirmPanel.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |

> **1 control(s) here have no accessible name** (icon-only: Check). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/templatestudio/TemplateBuilderForm.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Retry | **—** |
| button | Save changes | edit-flows.spec.ts |
| button | Back | **—** |
| button | Next Step | create-agent.spec.ts, walk2.spec.ts |
| button | Submit for approval | **—** |

## frontend/src/components/templatestudio/TemplateFiltersPanel.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Clear all | **—** |
| button | Done | xml-api-in-ui.spec.ts |

> **2 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/templatestudio/TemplateListEmptyStates.tsx

| Control | Name | Covered by |
|---|---|---|
| link | Go to Settings | **—** |
| button | Clear filters | **—** |
| button | New template | **—** |
| button | Create manually | **—** |

## frontend/src/components/templatestudio/TemplateListToolbar.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Bulk import | **—** |
| button | Create manually | **—** |
| button | New template | **—** |
| button | Filters | **—** |
| button | Refresh | **—** |

## frontend/src/components/templatestudio/TemplateSubmitSuccess.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Back to Templates | **—** |
| button | Create another | **—** |

## frontend/src/components/templatestudio/TemplateTable.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Previous | **—** |
| button | Next | create-agent.spec.ts, walk2.spec.ts |

> **1 control(s) here have no accessible name** (icon-only: Pencil). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/templatestudio/builder/ButtonsEditor.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Add button ( / ) | **—** |
| button | Remove button | **—** |

## frontend/src/components/templatestudio/builder/CarouselEditor.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Card | **—** |
| button | Remove card <…> | **—** |
| button | Add card ( /10) | **—** |

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/templatestudio/builder/LimitedTimeOfferEditor.tsx

> **1 control(s) here have no accessible name**. Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/templatestudio/builder/TemplateMetaFields.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Change | **—** |

## frontend/src/components/templatestudio/settings/AddWabaPanel.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Fetch phone numbers | **—** |
| button | Cancel | edit-flows.spec.ts, journey-editable.spec.ts, xml-api-in-ui.spec.ts |
| button | Confirm &amp; register | **—** |
| button | Back | **—** |

## frontend/src/components/templatestudio/settings/PhoneMappingTable.tsx

| Control | Name | Covered by |
|---|---|---|
| button | Save mappings | edit-flows.spec.ts |

## frontend/src/components/templatestudio/settings/WabaBlock.tsx

| Control | Name | Covered by |
|---|---|---|
| button | WABA · | **—** |

> **1 control(s) here have no accessible name** (icon-only: Loader2). Untestable by name, and a screen reader cannot announce them.

## frontend/src/components/templatestudio/settings/WabaSettingsSection.tsx

| Control | Name | Covered by |
|---|---|---|
| button | + Add WABA | **—** |
| button | Add WABA | **—** |

