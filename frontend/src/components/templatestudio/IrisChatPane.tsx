import { Link } from 'react-router-dom'
import { Loader2, Send, ShieldAlert, Settings, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../../lib/utils'
import ErrorBanner from '../shared/ErrorBanner'

export interface IrisChatEntry {
  id: string
  who: 'user' | 'iris'
  text: string
  link?: { label: string; to: string }
  status?: 'sending' | 'sent' | 'error'
  errorMessage?: string
}

const SUGGESTIONS = [
  'Create a shipping-update template',
  'Help me plan a marketing message',
  'Send a test of an approved template',
]

export default function IrisChatPane({
  needsSetup,
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
}: {
  needsSetup: boolean
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
}) {
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
            <Composer input={input} setInput={setInput} onSubmit={() => onSubmit()} disabled={thinking} pending={false} />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            {SUGGESTIONS.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => onSuggestion(text)}
                className="text-sm text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-foreground hover:decoration-foreground"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-6 overflow-y-auto px-8 py-8">
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
              <div key={e.id} className="max-w-[85%] space-y-1">
                <div className="prose prose-sm max-w-none text-base leading-relaxed text-foreground [&_p]:my-0 [&_pre]:rounded-lg [&_pre]:border [&_pre]:bg-foreground/5 [&_pre]:p-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono [&_a]:text-primary [&_a]:hover:underline">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.text}</ReactMarkdown>
                </div>
                {e.link && (
                  <Link to={e.link.to} className="inline-block text-sm font-medium text-primary hover:underline">
                    {e.link.label}
                  </Link>
                )}
              </div>
            ),
          )}
          {thinking && (
            <p className="animate-pulse text-sm italic text-muted-foreground">Iris is thinking…</p>
          )}
          {error && <ErrorBanner error={error} />}
          <div ref={bottomRef} />
        </div>
      )}

      {started && (
        <div className="space-y-2 border-t bg-background px-6 py-4">
          {needsSetup && <SetupBanner />}
          <Composer input={input} setInput={setInput} onSubmit={() => onSubmit()} disabled={thinking} pending={pending} />
        </div>
      )}
    </div>
  )
}

function Composer({
  input, setInput, onSubmit, disabled, pending,
}: {
  input: string
  setInput: (v: string) => void
  onSubmit: () => void
  disabled: boolean
  pending: boolean
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-full border bg-background px-5 py-3 shadow-surface-resting transition-shadow focus-within:ring-2 focus-within:ring-brand-purple/40">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit() }}
        disabled={pending || disabled}
        placeholder={pending ? 'Confirm or cancel the pending action…' : 'Ask Iris to create a template…'}
        className="flex-1 bg-transparent text-base placeholder:text-muted-foreground outline-none focus-visible:outline-none disabled:opacity-50"
      />
      <button
        type="button"
        disabled={!input.trim() || pending || disabled}
        onClick={onSubmit}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40',
          pending ? 'bg-muted-foreground/40' : 'bg-brand-pink',
        )}
        aria-label="Send"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  )
}

function SetupBanner() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span>No WABA or AI provider connected yet — Iris can chat, but can&apos;t create or send templates until then.</span>
      <Link
        to="/templates/settings"
        className="flex shrink-0 items-center gap-1 font-medium text-foreground hover:underline"
      >
        <Settings className="h-3 w-3" />
        Settings
      </Link>
    </div>
  )
}
