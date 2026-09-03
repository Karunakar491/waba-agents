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

export function parseAsUtc(iso: string): Date {
  const hasZone = /[Zz]|[+-]\d{2}:\d{2}$/.test(iso)
  return new Date(hasZone ? iso : `${iso}Z`)
}

const IST_TIME_ZONE = 'Asia/Kolkata'
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

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

// Meta sends webhook timestamps as epoch seconds in a string (e.g. "1786677901").
export function formatEpochSecondsIST(epochSeconds: string): string {
  return formatTimeIST(new Date(Number(epochSeconds) * 1000).toISOString())
}

// Inverse of the above, for filter inputs: an HTML <input type="datetime-local">
// value ("YYYY-MM-DDTHH:mm") carries NO timezone at all — it's whatever the
// operator typed, read literally. Labeling the field "(IST)" only means
// something if we then interpret it as IST ourselves, not as the viewing
// browser's OS timezone (the same trap this whole file exists to avoid).
// IST has no DST, so a fixed +05:30 offset is always correct — build the
// UTC instant directly and format it back out with no zone suffix, matching
// the naive-UTC shape the backend's LocalDateTime columns are stored in.
export function istInputToUtcNaiveIso(value: string): string | undefined {
  if (!value) return undefined
  const [datePart, timePart] = value.split('T')
  if (!datePart || !timePart) return undefined
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS
  return new Date(utcMs).toISOString().slice(0, 19)
}

/**
 * The UTC instant (ms) of 00:00 IST for the IST calendar day containing
 * `instant` — for "is this Today/Yesterday" bucketing. Deliberately not
 * `new Date(); date.setHours(0,0,0,0)` (that zeroes the VIEWER's own OS
 * timezone's midnight, the exact bug this file exists to avoid — a viewer
 * on a non-IST machine would get a different "today" boundary than one in
 * India looking at the same data).
 */
export function istStartOfDayMs(instant: Date): number {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant) // "YYYY-MM-DD"
  const [year, month, day] = ymd.split('-').map(Number)
  return Date.UTC(year, month - 1, day) - IST_OFFSET_MS
}
