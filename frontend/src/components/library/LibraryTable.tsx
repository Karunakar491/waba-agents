import type { ReactNode } from 'react'
import StatusIndicator, { type StatusTone } from '../shared/StatusIndicator'

/**
 * Screen: Library lists (Skills / Knowledgebase / Connectors / Business Persona)
 *
 * 1. USER GOAL: find one specific thing — "the skill that quotes prices", "the
 *    connector that broke" — and act on it.
 * 2. EMOTIONAL STATE: mid-problem. They arrived because something is wrong or
 *    something changed, not to browse.
 * 3. POSSIBLE ACTIONS: open it, edit it, delete it, publish it.
 * 4. HOW WE HELP: one row each, aligned columns, and "used by N agents" stated
 *    before they touch anything.
 *
 * Replaces the card grid these pages used (founder, 2026-09-06: "Change it to
 * tables"). Cards made you read every item to find one; a table lets you scan a
 * single column. The card grid suited browsing, and browsing turned out not to
 * be why anyone opens these screens.
 *
 * The "Used by" column is the one that earns its place. Editing a thing used by
 * nobody is free; editing one on four live agents changes what four sets of
 * customers are told. That number is the difference, so it is a column rather
 * than a footnote — and it is a count, not agent names, which would wrap the
 * row and bury the rest.
 */
export interface LibraryTableRow {
  id: string
  /** The item's own words — what the user wrote, not an id. */
  name: string
  /** Optional second line: description, base URL, whatever identifies it. */
  detail?: string | null
  /** Short flags (industry, use case, auth type). */
  tags?: string[]
  /**
   * Which agent this row belongs to.
   *
   * The Skills library shows the same skill once per agent — `intent-router`
   * appeared nine times on the live account, every row reading "Published, 1
   * agent, 25d ago" with nothing to tell them apart. Deleting the wrong one is a
   * live change to a real customer's agent. The data was always in the API
   * response and simply was not rendered.
   */
  owner?: string | null
  /**
   * A warning under the name, for when the name does not identify the row.
   *
   * On the live account one agent carries ten separate skills all titled
   * `intent-router`, with bodies of 5127, 6266, 4814… characters — genuinely
   * different rules sharing a name, which Meta permits. The table presented them
   * as ten identical rows, so it looked like duplicated data and made deleting
   * the wrong one easy. Saying so is more honest than hiding it.
   */
  nameNote?: string | null
  statusLabel: string
  statusTone: StatusTone
  /** How many agents use it. Null when the page genuinely cannot know. */
  usedByCount: number | null
  /**
   * A shortfall under the count — "2 need redeploying". Only for when the live
   * version is behind what is saved here; a user who edits, sees "Saved" and
   * walks away believing customers now get the new answer is the failure this
   * line exists to prevent.
   */
  usedByNote?: string | null
  /** ISO timestamp, or null when the item does not carry one. */
  updatedAt?: string | null
  /** Row-level buttons — Edit, Delete, Publish. Supplied by the page. */
  actions: ReactNode
  /** Opening the row. Omit for pages where the row itself is not clickable. */
  onOpen?: () => void
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return '—'
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/**
 * Said as a sentence, because "0" in a column headed "Used by" reads as a
 * measurement when it is actually a warning — nothing is using this.
 */
function usageLabel(count: number | null): { text: string; muted: boolean } {
  if (count === null) return { text: '—', muted: true }
  if (count === 0) return { text: 'No agents', muted: true }
  return { text: `${count} agent${count === 1 ? '' : 's'}`, muted: false }
}

/** Tags past this many collapse to a count — five wrapping chips doubled the row height. */
const MAX_TAGS = 3

export default function LibraryTable({
  rows,
  /** What the first column is called on this page: "Skill", "Connector". */
  itemLabel,
  showUpdated = true,
  /** Column heading for `owner`, e.g. "On agent". Omit to hide the column. */
  ownerLabel,
}: {
  rows: LibraryTableRow[]
  itemLabel: string
  showUpdated?: boolean
  ownerLabel?: string
}) {
  const showOwner = !!ownerLabel && rows.some((r) => r.owner)
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-surface-resting">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {[
              itemLabel,
              ...(showOwner ? [ownerLabel!] : []),
              'Status',
              'Used by',
              ...(showUpdated ? ['Last updated'] : []),
              '',
            ].map(
              (header, i) => (
                <th
                  key={header || `actions-${i}`}
                  className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {header || <span className="sr-only">Actions</span>}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const usage = usageLabel(row.usedByCount)
            return (
              <tr
                key={row.id}
                onClick={row.onOpen}
                className={
                  row.onOpen
                    ? 'cursor-pointer transition-colors hover:bg-muted/40'
                    : 'transition-colors hover:bg-muted/20'
                }
              >
                <td className="max-w-md px-5 py-2.5">
                  <p className="truncate font-medium text-foreground" title={row.name}>
                    {row.name}
                  </p>
                  {row.detail && (
                    <p className="truncate text-xs text-muted-foreground" title={row.detail}>
                      {row.detail}
                    </p>
                  )}
                  {row.nameNote && (
                    <p className="text-xs font-medium text-warning">{row.nameNote}</p>
                  )}
                  {row.tags && row.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {row.tags.slice(0, MAX_TAGS).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                      {row.tags.length > MAX_TAGS && (
                        <span
                          className="text-xs text-muted-foreground"
                          title={row.tags.slice(MAX_TAGS).join(', ')}
                        >
                          +{row.tags.length - MAX_TAGS}
                        </span>
                      )}
                    </div>
                  )}
                </td>

                {showOwner && (
                  <td className="max-w-[12rem] px-5 py-2.5">
                    {row.owner ? (
                      <span className="block truncate text-muted-foreground" title={row.owner}>
                        {row.owner}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                )}

                <td className="px-5 py-2.5">
                  <StatusIndicator label={row.statusLabel} tone={row.statusTone} />
                </td>

                <td className="px-5 py-2.5">
                  <span
                    className={`tabular-nums ${
                      usage.muted ? 'text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {usage.text}
                  </span>
                  {row.usedByNote && (
                    <span className="block text-xs font-medium text-warning">{row.usedByNote}</span>
                  )}
                </td>

                {showUpdated && (
                  <td className="px-5 py-2.5 text-xs tabular-nums text-muted-foreground">
                    {row.updatedAt ? timeAgo(row.updatedAt) : '—'}
                  </td>
                )}

                {/* Actions must not also open the row: a user reaching for
                    Delete has not asked to navigate. */}
                <td className="px-5 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">{row.actions}</div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function LibraryTableSkeleton({ showUpdated = true }: { showUpdated?: boolean }) {
  const cols = showUpdated ? 5 : 4
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-surface-resting">
      <div className="divide-y">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-5 px-5 py-4">
            {Array.from({ length: cols }, (_, c) => (
              <div
                key={c}
                className={`h-4 animate-pulse rounded bg-muted ${c === 0 ? 'flex-1' : 'w-20'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
