// Founder-caught gap (2026-08-07): every timestamp display in the app used
// `new Date(iso).toLocaleString()` with no timeZone option — that converts
// using the VIEWER's own OS/browser timezone setting, not India's. This is
// an India-only product (Karix BSP); timestamps must always read as IST,
// regardless of what timezone the viewing machine happens to be set to.
//
// Backend sends naive LocalDateTime strings with no offset/'Z'
// (e.g. "2026-08-07T10:04:15.057911") that are actually UTC instants —
// parseAsUtc treats them as UTC explicitly rather than trusting whatever
// the JS engine's ambiguous no-offset parsing rule does.

function parseAsUtc(iso: string): Date {
  const hasZone = /[Zz]|[+-]\d{2}:\d{2}$/.test(iso)
  return new Date(hasZone ? iso : `${iso}Z`)
}

const IST_TIME_ZONE = 'Asia/Kolkata'

export function formatTimeIST(iso: string): string {
  return parseAsUtc(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: IST_TIME_ZONE,
  })
}

export function formatDateTimeIST(iso: string): string {
  return parseAsUtc(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: IST_TIME_ZONE,
  })
}
