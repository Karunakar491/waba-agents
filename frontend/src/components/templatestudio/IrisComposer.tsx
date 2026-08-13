import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Paperclip, Send, Settings, Square, X } from 'lucide-react'
import { cn } from '../../lib/utils'

const MAX_COMPOSER_HEIGHT_PX = 200

export interface IrisAttachment {
  fileName: string
  status: 'uploading' | 'ready' | 'error'
  fileHandle?: string
  errorMessage?: string
}

// Extracted from IrisChatPane.tsx (V2 rebrand slice 5) to keep that file
// under the 200-line component ceiling.
export function Composer({
  input, setInput, onSubmit, disabled, pending, thinking, onAbort,
  attachment, onAttach, onRemoveAttachment,
}: {
  input: string
  setInput: (v: string) => void
  onSubmit: () => void
  disabled: boolean
  pending: boolean
  thinking: boolean
  onAbort: () => void
  attachment: IrisAttachment | null
  onAttach: (file: File) => void
  onRemoveAttachment: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sending clears `input` from the parent, outside any onChange on this
  // element -- without this, the textarea stayed tall after a multi-line
  // send since only onChange re-measured its height.
  useEffect(() => {
    if (input === '' && textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [input])

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT_PX)}px`
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter') return
    // Ctrl+Enter / Shift+Enter inserts a newline (default textarea
    // behavior); plain Enter sends -- matches every mainstream chat UI, and
    // is what the founder asked for explicitly (2026-08-12).
    if (e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    onSubmit()
  }

  return (
    // Flattened per Design Evaluator review (2026-08-07 Iris redesign, Direction
    // 3 salvage): rounded-full pill + circular send button was a DESIGN.md
    // violation (rounded-full reserved for avatars/icon-only controls) and part
    // of the generic-ChatGPT-clone tell. rounded-lg bar with a square icon
    // button keeps the same 44px+ touch target without the pill silhouette.
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      {attachment && (
        // Figma node 108:111 "AttachBtn" -- image only for now: Meta's
        // header_handle flow (see create_template's HEADER schema) is the
        // only thing this handle feeds, and only IMAGE/VIDEO/DOCUMENT
        // headers use it. Video/document support is a straightforward
        // extension of this same chip once Iris's tool-call wiring for
        // those formats is verified live.
        <div className="flex items-center gap-2 self-start rounded-lg border bg-muted px-3 py-1.5 text-xs">
          {attachment.status === 'uploading' && <span className="text-muted-foreground">Uploading {attachment.fileName}…</span>}
          {attachment.status === 'ready' && <span className="text-foreground">📎 {attachment.fileName}</span>}
          {attachment.status === 'error' && <span className="text-destructive">{attachment.errorMessage || 'Upload failed'}</span>}
          <button type="button" onClick={onRemoveAttachment} aria-label="Remove attachment" className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex w-full items-end gap-3 rounded-lg border bg-background px-5 py-3 shadow-surface-resting transition-shadow focus-within:ring-2 focus-within:ring-accent-teal-solid/40">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) onAttach(file); e.target.value = '' }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={pending || disabled || attachment?.status === 'uploading'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Attach an image"
        title="Attach an image for a template header"
      >
        <Paperclip className="h-4 w-4" />
      </button>
      <textarea
        ref={textareaRef}
        rows={1}
        value={input}
        onChange={(e) => { setInput(e.target.value); autoGrow(e.target) }}
        onKeyDown={handleKeyDown}
        disabled={pending || disabled}
        placeholder={pending ? 'Confirm or cancel the pending action…' : 'Ask Iris to create a template… (Enter to send, Ctrl+Enter for a new line)'}
        className="flex-1 resize-none bg-transparent text-base leading-6 placeholder:text-muted-foreground outline-none focus-visible:outline-none disabled:opacity-50"
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
          disabled={(!input.trim() && !attachment) || pending || disabled || attachment?.status === 'uploading'}
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
