import { formatListTimestampIST } from './dateFormat'

/**
 * The bug this guards: the Inbox showed bare times, so a conversation last
 * touched on 27 August read "01:08 pm" and looked like it happened an hour
 * ago. The real timestamps below are from production conversations
 * (lastMessageAt, 2026-09-03).
 *
 * Backend sends naive UTC ("2026-09-02T13:08:20"), so every expectation here
 * is the IST rendering of that instant.
 */
describe('formatListTimestampIST', () => {
  // 2026-09-03 18:00 UTC = 2026-09-03 23:30 IST — late evening in India, which
  // is deliberately the awkward case: UTC is still on the same date here, but
  // an hour later it would not be.
  const now = new Date('2026-09-03T18:00:00Z')

  it('shows a time for today', () => {
    // 2026-09-03 12:38 UTC = 18:08 IST, same IST day as `now`.
    expect(formatListTimestampIST('2026-09-03T12:38:00', now)).toMatch(/06:08\s*pm/i)
  })

  it('says Yesterday rather than a bare time', () => {
    expect(formatListTimestampIST('2026-09-02T13:08:20', now)).toBe('Yesterday')
  })

  it('names the weekday inside the last week', () => {
    // 2026-09-01 was a Tuesday.
    expect(formatListTimestampIST('2026-09-01T07:26:39', now)).toBe('Tue')
  })

  it('shows a date for the older rows that used to look like today', () => {
    // The actual regression: this row rendered as "01:08 pm".
    expect(formatListTimestampIST('2026-08-27T07:38:44', now)).toBe('27 Aug')
  })

  it('omits the year within the current year and includes it before that', () => {
    expect(formatListTimestampIST('2026-01-15T10:00:00', now)).toBe('15 Jan')
    expect(formatListTimestampIST('2025-12-31T10:00:00', now)).toMatch(/31 Dec 2025/)
  })

  it('crosses the IST midnight boundary, not the UTC one', () => {
    // 2026-09-03 19:00 UTC is 2026-09-04 00:30 IST — already tomorrow in
    // India. An instant at 2026-09-03 20:00 IST is then "Yesterday", even
    // though both are the 3rd in UTC. Getting this wrong is the whole reason
    // istStartOfDayMs exists.
    const afterIstMidnight = new Date('2026-09-03T19:00:00Z')
    expect(formatListTimestampIST('2026-09-03T14:30:00', afterIstMidnight)).toBe('Yesterday')
  })

  it('does not throw on an unparseable value', () => {
    expect(formatListTimestampIST('not a date', now)).toBe('—')
  })
})
