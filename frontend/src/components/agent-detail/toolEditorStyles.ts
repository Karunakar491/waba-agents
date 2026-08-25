// Shared with AddToolModal's own inputCls in AgentDetailPage.tsx — one focus-ring language
// across the whole modal (UX finding: ToolParamsEditor/ToolBodyEditor previously each defined
// their own inputCls with a different ring color than the parent form).
export const inputCls =
  'rounded-lg border bg-background px-3 py-2.5 text-xs placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

// 44x44 minimum touch target (UX finding: remove buttons and checkboxes were ~26px/16px).
export const touchButtonCls =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition ' +
  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export const touchCheckboxCls = 'h-5 w-5 shrink-0'
