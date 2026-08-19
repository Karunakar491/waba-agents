import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, Loader2, ShieldAlert, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../../lib/utils'
import ErrorBanner from '../shared/ErrorBanner'
import StatusIndicator from '../shared/StatusIndicator'
import IrisDraftSnapshotCard from './IrisDraftSnapshotCard'
import { Composer, SetupBanner, DefaultKeyNotice, type IrisAttachment } from './IrisComposer'

export interface IrisChatEntry {
  id: string
  who: 'user' | 'iris'
  text: string
  link?: { label: string; to: string }
  status?: 'sending' | 'sent' | 'error'
  errorMessage?: string
  toolName?: string | null
  templateArgs?: Record<string, unknown> | null
  previousTemplateArgs?: Record<string, unknown> | null
}

// Labeled category+description pills (Figma node 108:37) — replaces the
// old plain underlined-text links. Category matches Meta's real fixed
// enum (Marketing/Utility/Authentication), plus Carousel as a message
// shape, not a Meta category — same distinction TemplateFiltersPanel
// draws elsewhere in Template Studio.
const SUGGESTIONS = [
  { category: 'Marketing', text: 'Plan a Diwali sale message' },
  { category: 'Utility', text: 'Draft a shipping-update template' },
  { category: 'Authentication', text: 'Set up an OTP login template' },
  { category: 'Carousel', text: 'Showcase 3 products in one message' },
]

export default function IrisChatPane({
  needsSetup,
  usingPlatformDefault,
  resuming,
  started,
  entries,
  input,
  setInput,
  pending,
  thinking,
  error,
  bottomRef,
  onSubmit,
  onRetry,
  onSuggestion,
  onAbort,
  attachment,
  onAttach,
  onAttachSheet,
  onRemoveAttachment,
}: {
  needsSetup: boolean
  usingPlatformDefault: boolean
  resuming: boolean
  started: boolean
  entries: IrisChatEntry[]
  input: string
  setInput: (v: string) => void
  pending: boolean
  thinking: boolean
  error: string | null
  bottomRef: React.RefObject<HTMLDivElement | null>
  onSubmit: (text?: string) => void
  onRetry: (entry: IrisChatEntry) => void
  onSuggestion: (text: string) => void
  onAbort: () => void
  attachment: IrisAttachment | null
  onAttach: (file: File) => void
  onAttachSheet: (file: File) => void
  onRemoveAttachment: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    setShowTopFade(el.scrollTop > 8)
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
  }

  useEffect(() => { onScroll() }, [entries.length])

  if (resuming) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      {started && (
        <div className="flex items-center gap-1.5 border-b px-8 py-2.5 text-sm text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          Nothing is submitted to Meta until you review and confirm the exact result.
        </div>
      )}

      {!started ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">What do you want to send today?</h2>
            <p className="max-w-sm text-base text-muted-foreground">
              Describe a template in plain language — Iris drafts it with you and shows you the exact result
              before anything goes out.
            </p>
          </div>
          <div className="w-full max-w-3xl space-y-2">
            {needsSetup && <SetupBanner />}
            {usingPlatformDefault && <DefaultKeyNotice />}
            <Composer input={input} setInput={setInput} onSubmit={() => onSubmit()} disabled={thinking} pending={false} thinking={thinking} onAbort={onAbort} attachment={attachment} onAttach={onAttach} onAttachSheet={onAttachSheet} onRemoveAttachment={onRemoveAttachment} />
          </div>
          <div className="flex max-w-3xl flex-wrap items-center justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                type="button"
                onClick={() => onSuggestion(s.text)}
                className="rounded-full border bg-background px-4 py-2 text-sm text-foreground transition hover:border-accent-teal-solid/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              >
                <span className="font-medium text-accent-teal-solid">{s.category}</span>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span className="text-muted-foreground">{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          {/* Scroll affordances (DESIGN.md §6) — top fade signals more content
              above; scroll-to-bottom appears once scrolled up more than a
              screenful. Neither existed before this V2 rebrand pass. */}
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-card to-transparent transition-opacity',
              showTopFade ? 'opacity-100' : 'opacity-0',
            )}
          />
          {showScrollBtn && (
            <button
              type="button"
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
              aria-label="Scroll to latest message"
              className="absolute bottom-4 right-8 z-10 flex h-9 w-9 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-surface-lifted transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          )}
          <div ref={scrollRef} onScroll={onScroll} className="h-full space-y-6 overflow-y-auto px-8 py-8">
          {entries.map((e) =>
            e.who === 'user' ? (
              <div key={e.id} className="flex flex-col items-end gap-1">
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl border px-4 py-2.5 text-base text-foreground',
                    e.status === 'error' ? 'border-destructive/40 bg-muted' : 'bg-muted',
                    e.status === 'sending' && 'opacity-60',
                  )}
                >
                  {e.text}
                  {e.status === 'sending' && (
                    <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                {e.status === 'error' && (
                  <div className="flex items-center gap-2 text-xs text-destructive">
                    <span>{e.errorMessage ?? 'Failed to send.'}</span>
                    <button
                      type="button"
                      onClick={() => onRetry(e)}
                      className="flex items-center gap-1 font-medium hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div key={e.id} className="max-w-[85%] space-y-2">
                <div className="prose prose-sm max-w-none text-base leading-relaxed text-foreground [&_p]:my-0 [&_pre]:rounded-lg [&_pre]:border [&_pre]:bg-foreground/5 [&_pre]:p-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono [&_a]:text-primary [&_a]:hover:underline">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.text}</ReactMarkdown>
                </div>
                {(e.toolName === 'create_template' || e.toolName === 'edit_template') && e.templateArgs && (
                  <IrisDraftSnapshotCard args={e.templateArgs} previousArgs={e.previousTemplateArgs ?? null} />
                )}
                {e.link && (
                  <Link to={e.link.to} className="inline-block text-sm font-medium text-primary hover:underline">
                    {e.link.label}
                  </Link>
                )}
              </div>
            ),
          )}
          {thinking && (
            <StatusIndicator label="Iris is thinking…" tone="positive" pulse />
          )}
          {error && <ErrorBanner error={error} />}
          <div ref={bottomRef} />
          </div>
        </div>
      )}

      {started && (
        <div className="space-y-2 border-t bg-background px-6 py-4">
          {needsSetup && <SetupBanner />}
          {usingPlatformDefault && <DefaultKeyNotice />}
          <Composer input={input} setInput={setInput} onSubmit={() => onSubmit()} disabled={thinking} pending={pending} thinking={thinking} onAbort={onAbort} attachment={attachment} onAttach={onAttach} onAttachSheet={onAttachSheet} onRemoveAttachment={onRemoveAttachment} />
        </div>
      )}
    </div>
  )
}
