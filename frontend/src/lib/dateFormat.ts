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

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Timestamp for a list row, where the reader needs to know *when* before they
 * need to know the exact minute.
 *
 * The Inbox showed bare times, so a conversation last touched on 27 August
 * read "01:08 pm" and was indistinguishable from one an hour old. The list was
 * sorted correctly the whole time; the display threw away the only part that
 * would have shown it (founder-reported 2026-09-03).
 *
 * Follows the convention every messaging app uses, because operators already
 * know how to read it: time today, "Yesterday", weekday within the last week,
 * then the date.
 *
 * `now` is injectable so this is testable without freezing the clock.
 */
export function formatListTimestampIST(iso: string, now: Date = new Date()): string {
  const instant = parseAsUtc(iso)
  if (Number.isNaN(instant.getTime())) return '—'

  const today = istStartOfDayMs(now)
  const thatDay = istStartOfDayMs(instant)
  const daysAgo = Math.round((today - thatDay) / DAY_MS)

  // Today is the one case where a time says more than a date does.
  if (daysAgo === 0) return formatTimeIST(iso)

  // Everything else gets a real date including the year (founder, 2026-09-06:
  // "It should have date and year").
  //
  // This used to say "Yesterday" for one day back and a weekday name — "Tue" —
  // for anything inside the last week, with the year appearing only when it
  // wasn't the current one. Both were friendlier to read and worse to scan: a
  // column of "Tue", "Mon", "Yesterday" cannot be compared at a glance, and
  // "Tue" is ambiguous the moment a week has passed. An operator scanning this
  // list is placing conversations in time, not being told a story about them.
  return instant.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST_TIME_ZONE,
  })
}
