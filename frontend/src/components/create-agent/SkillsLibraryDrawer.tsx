import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import api from '../../lib/api'
import type { LibrarySkill } from './StepSkills'

/**
 * Figma node 289:2 — the Skills Library drawer, open over the Skills step.
 *
 * DESIGN.md §6: a docked panel, not a Modal — the operator is comparing
 * library entries against the rules already on the agent behind it, which a
 * blocking overlay would hide.
 */
export default function SkillsLibraryDrawer({
  wabaId,
  attachedTitles,
  onAdd,
  onClose,
}: {
  wabaId: string
  attachedTitles: Set<string>
  onAdd: (skill: LibrarySkill) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [publishedOnly, setPublishedOnly] = useState(false)
  const [industry, setIndustry] = useState<string | null>(null)

  const { data: skills = [], isLoading } = useQuery<LibrarySkill[]>({
    queryKey: ['skills', wabaId],
    queryFn: () => api.get('/skills', { params: { wabaId } }).then((r) => r.data.data),
    enabled: !!wabaId,
  })

  const industries = useMemo(
    () => [...new Set(skills.map((s) => s.industry).filter(Boolean) as string[])],
    [skills],
  )

  const rows = skills.filter((s) => {
    if (publishedOnly && !s.deployed) return false
    if (industry && s.industry !== industry) return false
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
  })

  return (
    <aside
      aria-label="Skills Library"
      className="flex w-96 shrink-0 flex-col border-l bg-card"
    >
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Skills Library</p>
          <p className="mt-1 text-xs text-muted-foreground">Add one without leaving this step.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Skills Library"
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 border-b px-4 py-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills…"
          aria-label="Search skills"
          className="h-8 w-full rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-accent-teal-solid"
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={publishedOnly} onClick={() => setPublishedOnly((v) => !v)}>
            Published only
          </FilterChip>
          {industries.map((i) => (
            <FilterChip key={i} active={industry === i} onClick={() => setIndustry(industry === i ? null : i)}>
              {i}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="border-l-2 border-accent-teal-solid px-4 py-4 text-sm text-muted-foreground">
            {skills.length === 0
              ? 'No skills saved on this WABA yet. Write a rule on the left and use “Save to Library” to start one.'
              : 'No skills match these filters.'}
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((s) => {
              const already = attachedTitles.has(s.title)
              return (
                <li key={s.id} className="px-4 py-4">
                  <p className="text-sm text-foreground">{s.title}</p>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <span className="text-xs text-muted-foreground">
                      Used by {s.deployments?.length ?? 0} agents
                    </span>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => onAdd(s)}
                      className="rounded-lg border px-3 py-1 text-xs font-medium text-accent-teal-solid transition-colors hover:bg-accent-teal/10 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
                    >
                      {already ? 'Added' : '+ Add'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="border-t px-4 py-3">
        <Link
          to="/library/skills"
          className="text-sm font-medium text-accent-teal-solid transition-colors hover:underline"
        >
          See full Skills Library →
        </Link>
      </div>
    </aside>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition-colors',
        active
          ? 'border-accent-teal-solid bg-accent-teal/10 font-medium text-accent-teal-solid'
          : 'text-muted-foreground hover:border-accent-teal',
      )}
    >
      {children}
    </button>
  )
}
