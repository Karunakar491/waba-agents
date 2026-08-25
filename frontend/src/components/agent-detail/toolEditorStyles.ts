// Shared between ToolParamsEditor and ToolBodyEditor — one focus-ring language across both
// editors (UX finding: they previously each defined their own inputCls with a different ring
// color). AddToolModal's own inputCls (AgentDetailPage.tsx) is a separate, pre-existing
// definition with different sizing (py-2/text-sm) — not unified with this one, since changing
// it would restyle Name/Description/Method/Path, outside this task's scope. Both now use the
// same ring-primary/ring-offset-background language, which is the property that mattered.
export const inputCls =
  'rounded-lg border bg-background px-3 py-2.5 text-xs placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

// 44x44 minimum touch target (UX finding: remove buttons and checkboxes were ~26px/16px).
export const touchButtonCls =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition ' +
  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

// Add-row link-style buttons — same ring language as touchButtonCls (UX 2nd re-review: these
// still carried the old accent-teal ring after the first fix moved the split ring off the
// inputs). min-h-11 + items-center gives a real 44px vertical tap target even though the
// visible text is much shorter.
export const addButtonCls =
  'flex min-h-11 items-center gap-1 rounded text-xs text-accent-teal-solid hover:underline ' +
  'disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

// h-5/w-5 (20px) is the visible checkbox box — real UX affordance is a visually small control,
// but the wrapping <label> (see usage) gets min-h-11 + flex items-center so the actual tap
// target is 44px even though the box itself stays compact, matching common checkbox UI
// convention (the label text + box together form the target, not the box alone).
export const touchCheckboxCls = 'h-5 w-5 shrink-0'
export const checkboxLabelCls = 'flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground'

/** Slugifies a label into a DOM-id-safe fragment — "Query parameters" -> "query-parameters". Raw
 * spaces in an id (the prior version's bug) are invalid HTML, even though label[for] resolution
 * happened to still work via exact string match in every browser tested. */
export function idSlug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-')
}
