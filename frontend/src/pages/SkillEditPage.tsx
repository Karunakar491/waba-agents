import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import ErrorBanner from '../components/shared/ErrorBanner'
import { cn } from '../lib/utils'

interface WabaEntry {
  id: string
}

interface LibrarySkill {
  id: string
  title: string
  description: string
  body: string
  source: 'LIBRARY' | 'AGENT'
  agentId: string | null
}

// Founder-caught gap (2026-08-14): the "Edit skill" modal's Instructions
// textarea (rows=8, in a max-w-lg dialog) is too cramped to comfortably write
// or review real skill instructions (routinely several thousand characters).
// Moved to a dedicated route so Instructions gets the full viewport height,
// mirroring the id-in-URL detail-page pattern already used by WabaDetailPage.
// Scoped to the Skills Library's "My Skills" list only — SkillsTab's
// per-agent quick-edit modal (a different, lighter-weight context) is
// untouched.
export default function SkillEditPage() {
  const { skillId } = useParams<{ skillId: string }>()
  const navigate = useNavigate()

  const { data: wabas = [], isLoading: wabasLoading } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const waba = wabas[0] ?? null

  const { data: skills = [], isLoading: skillsLoading } = useQuery<LibrarySkill[]>({
    queryKey: ['library-skills', waba?.id],
    queryFn: () => api.get('/skills', { params: { wabaId: waba!.id } }).then((r) => r.data.data ?? []),
    enabled: !!waba,
  })

  const skill = skills.find((s) => s.id === skillId) ?? null
  const isLoading = wabasLoading || skillsLoading

  return skill ? (
    <SkillEditForm skill={skill} onClose={() => navigate('/library/skills')} />
  ) : (
    <div className="space-y-6">
      <BackLink />
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Skill not found — it may have been deleted.
        </p>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/library/skills"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to Skills Library
    </Link>
  )
}

const TITLE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

function SkillEditForm({ skill, onClose }: { skill: LibrarySkill; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(skill.title)
  const [description, setDescription] = useState(skill.description)
  const [body, setBody] = useState(skill.body)
  const [error, setError] = useState<string | null>(null)

  const isLibrary = skill.source === 'LIBRARY'
  const titleValid = title.length > 0 && title.length <= 64 && TITLE_PATTERN.test(title)

  const mutation = useMutation({
    mutationFn: () =>
      isLibrary
        ? api.put(`/skills/${skill.id}`, { title, description, body })
        : api.put(`/agents/${skill.agentId}/skills/${skill.id}`, { title, description, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills-view', skill.agentId] })
      queryClient.invalidateQueries({ queryKey: ['library-skills'] })
      onClose()
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const inputCls =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition'

  return (
    <div className="space-y-6">
      <BackLink />

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Edit skill</h1>
        <p className="mt-1 text-sm text-muted-foreground">{skill.title}</p>
      </div>

      {error && <ErrorBanner error={error} />}

      {isLibrary && (
        <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          This skill is shared from the Library. Saving updates it everywhere it's attached — agents using it
          won't reflect the change until they're synced.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Instructions</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="The actual instructions the agent follows for this skill."
            className={cn(inputCls, 'h-[60vh] resize-y font-mono text-sm leading-relaxed')}
          />
          <p className="text-xs text-muted-foreground text-right">{body.length.toLocaleString()}/20,000</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. handoff-guardrails"
              className={inputCls}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, hyphens only — e.g. <code>greeting-skill</code>
              </p>
              <p className="text-xs text-muted-foreground shrink-0 ml-2">{title.length}/64</p>
            </div>
            {title.length > 0 && !titleValid && (
              <p className="text-xs text-destructive">Doesn't match the required format.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell the agent WHEN to apply this skill — e.g. 'Apply when a customer asks about returns'"
              className={cn(inputCls, 'resize-none')}
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/1024</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 border-t pt-4">
        <button
          onClick={() => { setError(null); mutation.mutate() }}
          disabled={mutation.isPending || !titleValid || !description.trim() || !body.trim()}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent-teal-solid px-6 py-2.5
            text-sm font-semibold text-white transition-opacity hover:opacity-90
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLibrary ? 'Save draft' : 'Publish changes'}
        </button>
        <button
          onClick={onClose}
          disabled={mutation.isPending}
          className="rounded-lg border px-6 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
