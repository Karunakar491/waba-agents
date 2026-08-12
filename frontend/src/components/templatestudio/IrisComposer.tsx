import { Link } from 'react-router-dom'
import { Send, Settings, Square } from 'lucide-react'
import { cn } from '../../lib/utils'

// Extracted from IrisChatPane.tsx (V2 rebrand slice 5) to keep that file
// under the 200-line component ceiling.
export function Composer({
  input, setInput, onSubmit, disabled, pending, thinking, onAbort,
}: {
  input: string
  setInput: (v: string) => void
  onSubmit: () => void
  disabled: boolean
  pending: boolean
  thinking: boolean
  onAbort: () => void
}) {
  return (
    // Flattened per Design Evaluator review (2026-08-07 Iris redesign, Direction
    // 3 salvage): rounded-full pill + circular send button was a DESIGN.md
    // violation (rounded-full reserved for avatars/icon-only controls) and part
    // of the generic-ChatGPT-clone tell. rounded-lg bar with a square icon
    // button keeps the same 44px+ touch target without the pill silhouette.
    <div className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-lg border bg-background px-5 py-3 shadow-surface-resting transition-shadow focus-within:ring-2 focus-within:ring-accent-teal-solid/40">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit() }}
        disabled={pending || disabled}
        placeholder={pending ? 'Confirm or cancel the pending action…' : 'Ask Iris to create a template…'}
        className="flex-1 bg-transparent text-base placeholder:text-muted-foreground outline-none focus-visible:outline-none disabled:opacity-50"
      />
      {thinking ? (
        // UX-caught gap (2026-08-07 audit): there used to be no way to abort
        // a pending send at all -- the composer just locked until it resolved.
        <button
          type="button"
          onClick={onAbort}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted-foreground/40 text-white"
          aria-label="Stop"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      ) : (
        <button
          type="button"
          disabled={!input.trim() || pending || disabled}
          onClick={onSubmit}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-40',
            pending ? 'bg-muted-foreground/40' : 'bg-accent-teal-solid',
          )}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function SetupBanner() {
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
