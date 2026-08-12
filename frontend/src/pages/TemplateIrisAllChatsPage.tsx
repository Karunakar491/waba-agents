import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Search } from 'lucide-react'
import api from '../lib/api'
import type { SessionSummary } from '../store/irisSidebarStore'

// Iris "All Chats" (2026-08-12, V2 rebrand slice 5, Figma node 112:2) — the
// destination for the sidebar's "View all chats" link, which only shows the
// 5 most recent sessions per DESIGN.md. Reuses the same GET
// /templates/iris/sessions endpoint the sidebar already calls; no new
// backend needed. Grouped by Today/Yesterday/Previous 7 days/Older, with
// its own search — separate from the sidebar's search.
export default function TemplateIrisAllChatsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const sessionsQuery = useQuery<SessionSummary[]>({
    queryKey: ['iris-sessions'],
    queryFn: () => api.get('/templates/iris/sessions').then((r) => r.data.data),
  })

  const groups = useMemo(() => {
    const sessions = sessionsQuery.data ?? []
    const q = query.trim().toLowerCase()
    const filtered = q
      ? sessions.filter((s) => (s.title ?? 'New chat').toLowerCase().includes(q))
      : sessions
    return groupByRecency(filtered)
  }, [sessionsQuery.data, query])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <button type="button" onClick={() => navigate('/templates/iris')} className="flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2">
          <ArrowLeft className="h-3.5 w-3.5" />
          Iris
        </button>
        <span>›</span>
        <span className="font-medium text-foreground">All Chats</span>
      </div>

      <h1 className="text-2xl font-semibold text-foreground">All Chats</h1>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all chats…"
          className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        />
      </div>

      {sessionsQuery.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

      {!sessionsQuery.isLoading && groups.every((g) => g.sessions.length === 0) && (
        <p className="text-sm text-muted-foreground">
          {query ? `No chats match "${query}".` : 'No chats yet.'}
        </p>
      )}

      {!sessionsQuery.isLoading && groups.map((group) => (
        group.sessions.length > 0 && (
          <div key={group.label} className="space-y-1">
            <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">{group.label.toUpperCase()}</p>
            <div className="divide-y rounded-xl border bg-card">
              {group.sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate('/templates/iris', { state: { resumeSessionId: s.id } })}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
                >
                  <span className="truncate text-sm font-medium text-foreground">{s.title ?? 'New chat'}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatTimestamp(s.updatedAt)}</span>
                </button>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  )
}

function groupByRecency(sessions: SessionSummary[]): Array<{ label: string; sessions: SessionSummary[] }> {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayMs = startOfToday.getTime()
  const yesterdayMs = todayMs - 24 * 60 * 60 * 1000
  const sevenDaysMs = todayMs - 7 * 24 * 60 * 60 * 1000

  const buckets = { today: [] as SessionSummary[], yesterday: [] as SessionSummary[], last7: [] as SessionSummary[], older: [] as SessionSummary[] }
  for (const s of sessions) {
    const t = new Date(s.updatedAt).getTime()
    if (Number.isNaN(t)) { buckets.older.push(s); continue }
    if (t >= todayMs) buckets.today.push(s)
    else if (t >= yesterdayMs) buckets.yesterday.push(s)
    else if (t >= sevenDaysMs) buckets.last7.push(s)
    else buckets.older.push(s)
  }
  const byRecency = (a: SessionSummary, b: SessionSummary) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ;[buckets.today, buckets.yesterday, buckets.last7, buckets.older].forEach((b) => b.sort(byRecency))

  return [
    { label: 'Today', sessions: buckets.today },
    { label: 'Yesterday', sessions: buckets.yesterday },
    { label: 'Previous 7 days', sessions: buckets.last7 },
    { label: 'Older', sessions: buckets.older },
  ]
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const daysAgo = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
  if (daysAgo < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
