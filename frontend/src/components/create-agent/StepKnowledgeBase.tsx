import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import ErrorBanner from '../shared/ErrorBanner'
import { BottomBar, InfoNote, LinkAction, SectionCard, StepHeader, TextField } from './WizardChrome'

interface Faq {
  id: string
  question: string
  answer: string
}
interface AgentFile {
  id: string
  fileName: string
  status?: string | null
}
interface AgentWebsite {
  id: string
  url: string
  status?: string | null
}

const PROCESSING = new Set(['pending', 'processing', 'PENDING', 'PROCESSING', 'IN_PROGRESS'])

/**
 * Screen: Create Agent — Step 3, Knowledge Base (Figma node 213:2)
 *
 * 1. USER GOAL: Give the agent the material it should answer from.
 * 2. EMOTIONAL STATE: Unsure how much is enough — so the step says outright
 *    it's optional and fully editable later.
 * 3. POSSIBLE ACTIONS: Add an FAQ, upload a file, add a site to crawl, skip.
 * 4. HOW WE HELP: Crawls and uploads run in the background and say so, so
 *    nobody sits on this screen waiting for a job to finish.
 */
export default function StepKnowledgeBase({
  agentId,
  onBack,
  onNext,
}: {
  agentId: string | null
  onBack: () => void
  onNext: () => void
}) {
  const qc = useQueryClient()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const enabled = !!agentId
  const { data: faqs = [] } = useQuery<Faq[]>({
    queryKey: ['agent-faqs', agentId],
    queryFn: () => api.get(`/agents/${agentId}/faq`).then((r) => r.data.data),
    enabled,
  })
  const { data: files = [] } = useQuery<AgentFile[]>({
    queryKey: ['agent-files', agentId],
    queryFn: () => api.get(`/agents/${agentId}/files`).then((r) => r.data.data),
    enabled,
  })
  const { data: websites = [] } = useQuery<AgentWebsite[]>({
    queryKey: ['agent-websites', agentId],
    queryFn: () => api.get(`/agents/${agentId}/websites`).then((r) => r.data.data),
    enabled,
  })

  const processingCount =
    files.filter((f) => PROCESSING.has(f.status ?? '')).length +
    websites.filter((w) => PROCESSING.has(w.status ?? '')).length

  const invalidate = (key: string) => () => qc.invalidateQueries({ queryKey: [key, agentId] })
  const onError = (err: unknown) => setError(extractErrorMessage(err))

  const addFaq = useMutation({
    mutationFn: () =>
      api.post(`/agents/${agentId}/faq`, { question: question.trim(), answer: answer.trim() }),
    onSuccess: () => {
      setQuestion('')
      setAnswer('')
      void invalidate('agent-faqs')()
    },
    onError,
  })
  const removeFaq = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${agentId}/faq/${id}`),
    onSuccess: invalidate('agent-faqs'),
    onError,
  })
  const uploadFile = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.post(`/agents/${agentId}/files`, form)
    },
    onSuccess: invalidate('agent-files'),
    onError,
  })
  const removeFile = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${agentId}/files/${id}`),
    onSuccess: invalidate('agent-files'),
    onError,
  })
  const addWebsite = useMutation({
    mutationFn: () => api.post(`/agents/${agentId}/websites`, { url: websiteUrl.trim() }),
    onSuccess: () => {
      setWebsiteUrl('')
      void invalidate('agent-websites')()
    },
    onError,
  })
  const removeWebsite = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${agentId}/websites/${id}`),
    onSuccess: invalidate('agent-websites'),
    onError,
  })

  return (
    <>
      <StepHeader
        title="What else should it know?"
        subtitle="Optional — add FAQs, documents, or pages to crawl. Everything here stays fully editable later from Knowledge Base."
      >
        {processingCount > 0 && (
          <p className="mb-4 inline-flex items-center gap-3 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-accent-teal-solid" />
            {processingCount} knowledge {processingCount === 1 ? 'source' : 'sources'} processing in
            background
          </p>
        )}
      </StepHeader>

      {error && (
        <div className="mb-6">
          <ErrorBanner error={error} />
        </div>
      )}

      <div className="space-y-6">
        <SectionCard
          title="FAQs"
          description="Questions customers ask most, with self-contained answers."
          actions={
            <LinkAction
              onClick={() => {
                setError(null)
                addFaq.mutate()
              }}
              disabled={!enabled || !question.trim() || !answer.trim() || addFaq.isPending}
            >
              + Add FAQ
            </LinkAction>
          }
        >
          {faqs.length > 0 && (
            <ul className="divide-y">
              {faqs.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{f.question}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{f.answer}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFaq.mutate(f.id)}
                    aria-label={`Remove FAQ: ${f.question}`}
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <TextField
            id="kb-question"
            label="Question"
            value={question}
            onChange={setQuestion}
            placeholder="e.g. Do you ship internationally?"
            maxLength={512}
          />
          <TextField
            id="kb-answer"
            label="Answer"
            value={answer}
            onChange={setAnswer}
            placeholder="e.g. Currently we only ship within India."
          />
        </SectionCard>

        <SectionCard
          title="Files"
          description="PDF, Word, or spreadsheet documents — up to 100MB each."
          actions={
            <LinkAction onClick={() => fileInput.current?.click()} disabled={!enabled || uploadFile.isPending}>
              {uploadFile.isPending ? 'Uploading…' : '+ Upload file'}
            </LinkAction>
          }
        >
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadFile.mutate(file)
              e.target.value = ''
            }}
          />
          {files.length > 0 && (
            <ul className="divide-y">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-4 py-3">
                  <p className="min-w-0 truncate text-sm text-foreground">{f.fileName}</p>
                  <div className="flex shrink-0 items-center gap-4">
                    {f.status && <span className="text-xs text-muted-foreground">{f.status}</span>}
                    <button
                      type="button"
                      onClick={() => removeFile.mutate(f.id)}
                      aria-label={`Remove file: ${f.fileName}`}
                      className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Websites"
          description="Pages to crawl for answers — public pages only."
          actions={
            <LinkAction
              onClick={() => {
                setError(null)
                addWebsite.mutate()
              }}
              disabled={!enabled || !websiteUrl.trim() || addWebsite.isPending}
            >
              + Add website
            </LinkAction>
          }
        >
          {websites.length > 0 && (
            <ul className="divide-y">
              {websites.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-4 py-3">
                  <p className="min-w-0 truncate text-sm text-foreground">{w.url}</p>
                  <div className="flex shrink-0 items-center gap-4">
                    {w.status && <span className="text-xs text-muted-foreground">{w.status}</span>}
                    <button
                      type="button"
                      onClick={() => removeWebsite.mutate(w.id)}
                      aria-label={`Remove website: ${w.url}`}
                      className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <TextField
            id="kb-website"
            label="Page URL"
            type="url"
            value={websiteUrl}
            onChange={setWebsiteUrl}
            placeholder="e.g. https://yourbusiness.com/shipping"
          />
        </SectionCard>

        <InfoNote>
          Files and website crawls run in the background — you don't need to wait here to continue.
        </InfoNote>

        {(addFaq.isPending || addWebsite.isPending) && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </p>
        )}
      </div>

      <BottomBar onBack={onBack} onNext={onNext} />
    </>
  )
}
